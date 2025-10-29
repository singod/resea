import * as path from 'node:path'
import { defineConfig } from 'rspress/config'

export default defineConfig({
  lang: 'en',
  root: path.join(__dirname, 'docs'),
  title: 'ReSea for React',
  // icon: '/rspress-icon.png',
  // logo: {
  //   light: '/rspress-light-logo.png',
  //   dark: '/rspress-dark-logo.png'
  // },
  globalStyles: path.join(__dirname, 'styles/index.css'),
  locales: [
    // {
    //   lang: 'en',
    //   label: 'English',
    //   title: 'ReSea',
    //   description: 'Static Site Generator'
    // },
    {
      lang: 'zh',
      label: '简体中文',
      title: 'ReSea',
      description: '静态网站生成器'
    }
  ],
  themeConfig: {
    locales: [
      {
        lang: 'en',
        outlineTitle: 'ON THIS Page',
        label: ''
      },
      {
        lang: 'zh',
        outlineTitle: '大纲',
        label: ''
      }
    ],
    // socialLinks: [
    //   {
    //     icon: 'github',
    //     mode: 'link',
    //     content: 'https://github.com/singod/reSea'
    //   },
    //   {
    //     icon: 'gitlab',
    //     mode: 'link',
    //     content: 'https://gitee.com/arts1986/resea'
    //   }
    // ],
    
  },
  // base: '/resea/',
  // builderConfig: {
  //   output: {
  //     assetPrefix: '/resea/'
  //   }
  // }
})
