import { mapActions, mapMutations, mapState } from 'vuex'

export default {
  data: function () {
    return {
      $_editReadmeContent_modalOpen: false,
      $_editReadmeContent_content: ''
    }
  },
  computed: {
    ...mapState('Files', ['currentFolder']),
    $_editReadmeContent_items() {
      return [
        {
          name: 'editReadmeContent',
          icon: 'markdown',
          label: () => {
            return this.$gettext('Edit description')
          },
          handler: this.$_editReadmeContent_trigger,
          isEnabled: ({ resources }) => {
            if (resources.length !== 1) {
              return false
            }

            return resources[0].spaceReadmeData
          },
          componentType: 'oc-button',
          class: 'oc-files-actions-edit-readme-content-trigger'
        }
      ]
    }
  },
  methods: {
    ...mapActions([
      'createModal',
      'hideModal',
      'setModalInputErrorMessage',
      'showMessage',
      'toggleModalConfirmButton'
    ]),
    ...mapMutations('Files', ['UPDATE_RESOURCE_FIELD']),

    $_editReadmeContent_trigger({ resources }) {
      if (resources.length !== 1) {
        return
      }
      const webDavPathComponents = resources[0].spaceReadmeData.webDavUrl.split('/')
      const path = webDavPathComponents.slice(webDavPathComponents.indexOf('dav') + 1).join('/')

      this.$client.files.getFileContents(path).then((readmeContent) => {
        this.$data.$_editReadmeContent_modalOpen = true
        this.$data.$_editReadmeContent_content = readmeContent
      })
    },

    $_editReadmeContent_editReadmeContentSpace() {
      const space = this.currentFolder
      const webDavPathComponents = space.spaceReadmeData.webDavUrl.split('/')
      const path = webDavPathComponents.slice(webDavPathComponents.indexOf('dav') + 1).join('/')

      return this.$client.files
        .putFileContents(path, this.$data.$_editReadmeContent_content)
        .then((readmeMetaData) => {
          this.$_editReadmeContent_closeModal()
          this.UPDATE_RESOURCE_FIELD({
            id: space.id,
            field: 'spaceReadmeData',
            value: { ...space.spaceReadmeData, ...{ etag: readmeMetaData.ETag } }
          })
          this.showMessage({
            title: this.$gettext('Space description was edited successfully')
          })
        })
        .catch((error) => {
          console.error(error)
          this.showMessage({
            title: this.$gettext('Failed to edit space description'),
            status: 'danger'
          })
        })
    },

    $_editReadmeContent_closeModal() {
      this.$data.$_editReadmeContent_modalOpen = false
    }
  }
}