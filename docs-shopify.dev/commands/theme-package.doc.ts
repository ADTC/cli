// This is an autogenerated file. Don't edit this file manually.
import {ReferenceEntityTemplateSchema} from '@shopify/generate-docs'

const data: ReferenceEntityTemplateSchema = {
  name: 'theme package',
  description: `Packages your local theme files into a ZIP file that can be uploaded to Shopify.

  Only folders that match the [default Shopify theme folder structure](/docs/themes/tools/cli#directory-structure) are included in the package.

  The ZIP file uses the name \`theme_name-theme_version.zip\`, based on parameters in your [settings_schema.json](/docs/themes/architecture/config/settings-schema-json) file.`,
  overviewPreviewDescription: `Package your theme into a .zip file, ready to upload to the Online Store.`,
  type: 'command',
  isVisualComponent: false,
  defaultExample: {
    codeblock: {
      tabs: [
        {
          title: 'theme package',
          code: './examples/theme-package.example.sh',
          language: 'bash',
        },
      ],
      title: 'theme package',
    },
  },
  definitions: [
  {
    title: 'Flags',
    description: 'The following flags are available for the `theme package` command:',
    type: 'themepackage',
  },
  ],
  category: 'theme',
  related: [
  ],
}

export default data