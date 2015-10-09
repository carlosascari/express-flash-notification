/**
* Provides Flash Notification Middleware
*
* @module Express Flash Notification
*/
var format 			= require('util').format
var isArray 		= require('util').isArray
var async 			= require('async')

/**
* Default value for when calling the `req.flash` method withouth specifying 
* the redirect argument.
* 
* @property REDIRECT
* @type Boolean|String
* @final
*/
var REDIRECT = true

/**
* Default name of property stored in req.session that holds an array of notifications
* to display.
* 
* @property SESSION_NAME
* @type String
* @final
*/
var SESSION_NAME = 'flash'

/**
* Default name of method stored in `req` object used to trigger a request notification.
* 
* @property UTILITY_NAME
* @type String
* @final
*/
var UTILITY_NAME = 'flash'

/**
* Default locals property name used to render the flash notification markup.
* 
* @property LOCALS_NAME
* @type String
* @final
*/
var LOCALS_NAME = 'flash'

/**
* Default view template filename (extension) that will be passed to tthe express 
* template engine to generate the flash notification markup.
* 
* @property VIEW_NAME
* @type String
* @final
*/
var VIEW_NAME = 'flash'

/**
* Default callback that is called before each notification is rendered using the 
* express template engine.
* 
* @method BEFORE_SINGLE_RENDER
* @final
*/
var BEFORE_SINGLE_RENDER = function(item, callback){callback(null, item)}

/**
* Default callback that is called after all notifications have been rendered by the
* express template engine.
* 
* @method BEFORE_SINGLE_RENDER
* @param htmlFragments {Array} 
* @final 
*/
var AFTER_ALL_RENDER = function(htmlFragments, callback){callback(null, htmlFragments.join('\n'))}

/**
* Utility used to check whether an argument is a Native Object
* 
* @method isObject
* @return Boolean
* @private
*/
function isObject(sample)
{
	return (sample && typeof sample === 'object' && !isArray(sample))
}

/**
* Function used to expose express instance and configuration options. 
* The actual middleware is returned.
*
* @method Module
* @param app {Express}
* @param options {Object}
*/
function Module (app, options)
{
	if (isObject(options))
	{
		SESSION_NAME 			= options.session_name 			|| SESSION_NAME
		UTILITY_NAME 			= options.utility_name 			|| UTILITY_NAME
		LOCALS_NAME 			= options.locals_name 			|| LOCALS_NAME
		VIEW_NAME 				= options.view_name 			|| VIEW_NAME
		BEFORE_SINGLE_RENDER 	= (typeof options.beforeSingleRender === 'function')
									? options.beforeSingleRender
									: BEFORE_SINGLE_RENDER
		AFTER_ALL_RENDER 		= (typeof options.afterAllRender === 'function')
									? options.afterAllRender
									: AFTER_ALL_RENDER
	}

	/**
	* Render Notifications on queue
	*
	* @method render
	* @private
	*/
	function render (req, res, next) 
	{
		if (req.session[SESSION_NAME].length === 0)
		{
			next()
		}
		else
		{
			var resultHTML = []	

			async.each(
				req.session[SESSION_NAME],
				function(item, callback)
				{
					BEFORE_SINGLE_RENDER(item, function(err, item){
						if (err) return callback(err)
						app.render(VIEW_NAME, item, function(err, html) {
							if (err) return callback(err)
							resultHTML.push(html)
							callback(null)
						})
					})
				},
				function(err)
				{
					if (err) return next(err)
					req.session[SESSION_NAME].length = 0
					AFTER_ALL_RENDER(resultHTML, function(err, html){
						if (err) return next(err)
						res.locals[LOCALS_NAME] = html
						next()
					})
				}
			)
		}
	}

	/**
	* Adds flash method to req object and renders all notifications found in
	* req.session
	*
	* @method FlashMiddleware
	*/
	function FlashMiddleware(req, res, next)
	{
		if (!isObject(req.session)) 
		{
			throw new Error('express-session is required')
		}
		else
		{
			if (!isArray(req.session[SESSION_NAME])) 
			{
				req.session[SESSION_NAME] = []
			}
		}

		/**
		* Utility used to programmatically add flash notifications
		*
		* @method Flash Utility
		*/
		req[UTILITY_NAME] = function()
		{
			var notification 
			var redirect = REDIRECT
			var argc = arguments.length

			// Parse arguments
			if (argc === 1)
			{
				var arg = arguments[0]
				if (isObject(arg))
				{
					notification = arg, redirect = (arg.redirect === undefined) ? redirect : arg.redirect
				}
				else
				{
					notification = { message: arg + ''}
				}
			}
			else if (argc > 1)
			{
				notification = { type: arguments[0] + '', message: arguments[1] + '' }
				redirect = (arguments[2] === undefined) ? redirect : arguments[2]
			}
			else
			{
				return
			}

			// Queue Notification
			if (notification) 
			{
				req.session[SESSION_NAME].push(notification)
			}

			// If redirect is set, refresh or redirect, accordingly. Otherwise, render the
			// notifications now since it's on this request where they will be displayed.
			if (redirect)
			{
				var redirectUrl = (typeof redirect === 'string') ? redirect : req.originalUrl
				res.redirect(redirectUrl)
			}
			else
			{
				/**
				* When there is no redirect, notifications must be rendered now and since
				* rendering is async (and this method is sync), a *promise* like function is returned.
				* The function can be called with a callback that will be called after all notifcations
				* are rendered, otherwise, rendering will be done during the next request.
				*/
				return function ManualRender(callback) 
				{
					render(req, res, callback)
				}
			}
		}

		/**
		* Process Queued Notifications
		*/
		render(req, res, next)
	} 
	return FlashMiddleware
}

module.exports = Module
