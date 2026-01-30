import {
	createAppleSplashScreens,
	defineConfig,
	minimal2023Preset,
} from '@vite-pwa/assets-generator/config'

const darkBackground = '#1a1a1a'

export default defineConfig({
	headLinkOptions: {
		preset: '2023',
	},
	preset: {
		...minimal2023Preset,
		// Override maskable icon to use dark background
		maskable: {
			sizes: [512],
			padding: 0.1,
			resizeOptions: {
				background: darkBackground,
				fit: 'contain',
			},
		},
		// Override apple touch icon to use dark background
		apple: {
			sizes: [180],
			padding: 0.1,
			resizeOptions: {
				background: darkBackground,
				fit: 'contain',
			},
		},
		appleSplashScreens: createAppleSplashScreens({
			padding: 0.3,
			resizeOptions: {
				background: darkBackground,
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
