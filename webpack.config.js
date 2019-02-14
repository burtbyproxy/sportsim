var webpack = require('webpack'),
	path = require('path');

const TerserPlugin = require('terser-webpack-plugin');
const OptimizeCSSAssetsPlugin = require('optimize-css-assets-webpack-plugin');
const { VueLoaderPlugin } = require('vue-loader');

function resolve (dir) {
  return path.join(__dirname, '..', dir)
}

module.exports = {

	resolve: {
		alias: {
			'vue$': 'vue/dist/vue.esm.js',
			'@': resolve('src')
		}
	},

	entry: [
		'./src/index.js', // vue project
		'./src/scss/sim.scss'
	],

	output: {
		filename: 'sim.min.js',
		path: path.resolve(__dirname, 'dist')
	},

	watch: true,

	module: {
		rules: [
			{
				test: /\.vue$/,
				use: 'vue-loader'
			},
			{
				test: /\.scss$/,
				use: [
					{
						loader: 'file-loader',
						options: {
							name: '[name].min.css',
						}
					},
					{
						loader: 'extract-loader'
					},
					{
						loader: 'css-loader?-url'
					},
					{
						loader: 'postcss-loader',
						options: {
							plugins: () => [ require('autoprefixer') ]
						}
					},
					{
						loader: 'sass-loader'
					}
				]
			}			
		]
	},

	plugins: [
		new VueLoaderPlugin()
	],

	optimization: {
		minimizer: [
			new TerserPlugin({
				test: /\.js(\?.*)?$/i,
				parallel: true
			}),
			new OptimizeCSSAssetsPlugin({
				cssProcessorOptions: { discardComments: { removeAll: true } },
				canPrint: true
			})
		]
	}

};