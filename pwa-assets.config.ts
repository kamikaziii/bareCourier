import {
	createAppleSplashScreens,
	defineConfig,
	minimal2023Preset,
} from '@vite-pwa/assets-generator/config'

export default defineConfig({
	headLinkOptions: {
		preset: '2023',
	},
	preset: {
		...minimal2023Preset,
		appleSplashScreens: createAppleSplashScreens({
			padding: 0.3,
			resizeOptions: {
				background: '#ffffff',
				fit: 'contain',
			},
			linkMediaOptions: {
				log: true,
				addMediaScreen: true,
				basePath: '/',
				xhtml: false,
			},
			png: {
				compressionLevel: 9,
				quality: 80,
			},
		}),
	},
	images: ['static/images/logo-1024.png'],
})
