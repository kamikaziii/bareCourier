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
		// Override "any" icons to ensure 10% padding (standard PWA best practice)
		transparent: {
			sizes: [64, 192, 512],
			padding: 0.1,
			resizeOptions: {
				background: 'transparent',
				fit: 'contain',
			},
		},
		// Override maskable icon to use dark background
		// Padding 0.22 (22%) ensures icon fits within 40% radius safe zone
		// (40% radius circle = 80% diameter, square inscribed needs ~22% padding)
		maskable: {
			sizes: [512],
			padding: 0.22,
			resizeOptions: {
				background: darkBackground,
				fit: 'contain',
			},
		},
		// Override apple touch icon to use dark background
		// Padding 0.22 (22%) = ~40px margin on 180px icon (matches maskable icon spacing)
		apple: {
			sizes: [180],
			padding: 0.22,
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
