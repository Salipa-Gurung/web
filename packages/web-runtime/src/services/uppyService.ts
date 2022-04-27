import Uppy from '@uppy/core'
import { CustomTus } from '../composables/upload/uppyPlugins/customTus'
import XHRUpload, { XHRUploadOptions } from '@uppy/xhr-upload'
import { CustomDropTarget } from '../composables/upload/uppyPlugins/customDropTarget'
import StatusBar from '@uppy/status-bar'
import { UppyResource } from '../composables/upload'
import Vue from 'vue'

export class UppyService extends Vue {
  uppy: Uppy
  uploadInputs: HTMLInputElement[] = []

  constructor() {
    super()
    this.uppy = new Uppy({
      autoProceed: true
    })
    this.setUpEvents()
  }

  useTus({
    tusMaxChunkSize,
    uploadChunkSize,
    tusHttpMethodOverride,
    headers
  }: {
    tusMaxChunkSize: number
    uploadChunkSize: number
    tusHttpMethodOverride: boolean
    headers: { [key: string]: string }
  }) {
    const chunkSize =
      tusMaxChunkSize > 0 && uploadChunkSize !== Infinity
        ? Math.max(tusMaxChunkSize, uploadChunkSize)
        : uploadChunkSize

    const tusPluginOptions = {
      headers: headers,
      chunkSize: chunkSize,
      removeFingerprintOnSuccess: true,
      overridePatchMethod: !!tusHttpMethodOverride,
      retryDelays: [0]
    }

    const xhrPlugin = this.uppy.getPlugin('XHRUpload')
    if (xhrPlugin) {
      this.uppy.removePlugin(xhrPlugin)
    }

    const tusPlugin = this.uppy.getPlugin('Tus')
    if (tusPlugin) {
      tusPlugin.setOptions(tusPluginOptions)
      return
    }

    this.uppy.use(CustomTus, tusPluginOptions)
  }

  useXhr({ headers }: { headers: { [key: string]: string } }) {
    const xhrPluginOptions: XHRUploadOptions = {
      endpoint: '',
      method: 'put',
      headers,
      formData: false,
      getResponseData() {
        return {}
      }
    }

    const tusPlugin = this.uppy.getPlugin('Tus')
    if (tusPlugin) {
      this.uppy.removePlugin(tusPlugin)
    }

    const xhrPlugin = this.uppy.getPlugin('XHRUpload')
    if (xhrPlugin) {
      xhrPlugin.setOptions(xhrPluginOptions)
      return
    }

    this.uppy.use(XHRUpload, xhrPluginOptions)
  }

  useDropTarget({
    targetSelector,
    uppyService
  }: {
    targetSelector: string
    uppyService: UppyService
  }) {
    if (this.uppy.getPlugin('DropTarget')) {
      return
    }
    this.uppy.use(CustomDropTarget, {
      target: targetSelector,
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      uppyService
    })
  }

  removeDropTarget() {
    const dropTargetPlugin = this.uppy.getPlugin('DropTarget')
    if (dropTargetPlugin) {
      this.uppy.removePlugin(dropTargetPlugin)
    }
  }

  useStatusBar({
    targetSelector,
    getText
  }: {
    targetSelector: string
    getText: (msgid: string) => string
  }) {
    if (this.uppy.getPlugin('StatusBar')) {
      return
    }

    this.uppy.use(StatusBar, {
      id: 'StatusBar',
      target: targetSelector,
      hideAfterFinish: true,
      showProgressDetails: true,
      hideUploadButton: false,
      hideRetryButton: false,
      hidePauseResumeButton: false,
      hideCancelButton: false,
      doneButtonHandler: null,
      locale: {
        strings: {
          uploading: getText('Uploading'),
          complete: getText('Complete'),
          uploadFailed: getText('Upload failed'),
          paused: getText('Paused'),
          retry: getText('Retry'),
          cancel: getText('Cancel'),
          pause: getText('Pause'),
          resume: getText('Resume'),
          done: getText('Done'),
          filesUploadedOfTotal: {
            0: getText('%{complete} of %{smart_count} file uploaded'),
            1: getText('%{complete} of %{smart_count} files uploaded')
          },
          dataUploadedOfTotal: getText('%{complete} of %{total}'),
          xTimeLeft: getText('%{time} left'),
          uploadXFiles: {
            0: getText('Upload %{smart_count} file'),
            1: getText('Upload %{smart_count} files')
          },
          uploadXNewFiles: {
            0: getText('Upload +%{smart_count} file'),
            1: getText('Upload +%{smart_count} files')
          },
          upload: getText('Upload'),
          retryUpload: getText('Retry upload'),
          xMoreFilesAdded: {
            0: getText('%{smart_count} more file added'),
            1: getText('%{smart_count} more files added')
          },
          showErrorDetails: getText('Show error details')
        }
      }
    })
  }

  private setUpEvents() {
    this.uppy.on('upload', () => {
      this.$emit('uploadStarted')
    })
    this.uppy.on('cancel-all', () => {
      this.$emit('uploadCancelled')
    })
    this.uppy.on('complete', (result) => {
      this.$emit('uploadCompleted')
      result.successful.forEach((file) => {
        this.$emit('uploadSuccess', file)
        this.uppy.removeFile(file.id)
      })
      result.failed.forEach((file) => {
        this.$emit('uploadError', file)
      })
      this.uploadInputs.forEach((item) => {
        item.value = null
      })
    })
    this.uppy.on('file-removed', () => {
      this.$emit('uploadRemoved')
      this.uploadInputs.forEach((item) => {
        item.value = null
      })
    })
    this.uppy.on('file-added', (file) => {
      this.$emit('fileAdded')
      const addedFile = file as unknown as UppyResource
      if (this.uppy.getPlugin('XHRUpload')) {
        const escapedName = encodeURIComponent(addedFile.name)
        this.uppy.setFileState(addedFile.id, {
          xhrUpload: {
            endpoint: `${addedFile.meta.tusEndpoint.replace(/\/+$/, '')}/${escapedName}`
          }
        })
      }
    })
  }

  registerUploadInput(el: HTMLInputElement) {
    const listenerRegistered = el.getAttribute('listener')
    if (listenerRegistered !== 'true') {
      el.setAttribute('listener', 'true')
      el.addEventListener('change', (event) => {
        const target = event.target as HTMLInputElement
        const files = Array.from(target.files)
        this.$emit('filesSelected', files)
      })
      this.uploadInputs.push(el)
    }
  }

  removeUploadInput(el: HTMLInputElement) {
    this.uploadInputs = this.uploadInputs.filter((input) => input !== el)
  }

  uploadFiles(files: UppyResource[]) {
    files.forEach((file) => {
      try {
        this.uppy.addFile(file)
      } catch (err) {
        console.error('error upload file:', file)
        if (err.isRestriction) {
          // handle restrictions
          console.error('Restriction error:', err)
        } else {
          // handle other errors
          console.error(err)
        }
      }
    })
  }
}