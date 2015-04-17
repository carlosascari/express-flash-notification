var format 			= require('util').format
var isArray 		= require('util').isArray
var async 			= require('async')

var REDIRECT 		= true
var SESSION_NAME	= 'flash'
var UTILITY_NAME	= 'flash'
var LOCALS_NAME		= 'flash'
var VIEW_NAME 		= 'flash'
var BEFORE_SINGLE_RENDER 	= function(item, callback){callback(null, item)}
var AFTER_ALL_RENDER 		= function(htmlFragments, callback){callback(null, htmlFragments.join('\n'))}

function isObject(sample)
{
	return (typeof sample === 'object' && !isArray(sample))
}

function ConnectMiddleware (app, options)
{
	// Are we configuring the middleware?
	if (isObject(options))
	{
		SESSION_NAME 			= options.session_name 			|| SESSION_NAME
		UTILITY_NAME 			= options.utility_name 			|| UTILITY_NAME
		LOCALS_NAME 			= options.locals_name 			|| LOCALS_NAME
		VIEW_NAME 				= options.view_name 			|| VIEW_NAME
		BEFORE_SINGLE_RENDER 	= options.beforeSingleRender 	|| BEFORE_SINGLE_RENDER
		AFTER_ALL_RENDER 		= options.afterAllRender 		|| AFTER_ALL_RENDER
	}

	function Middleware(req, res, next)
	{
		if (!req.session) throw new Error('express-session is required')
		if (!isArray(req.session[SESSION_NAME])) req.session[SESSION_NAME] = []

		// Flash utility
		req[UTILITY_NAME] = function()
		{
			var notification 
			var redirect 	= REDIRECT
			var argc 		= arguments.length

			if (argc === 1)
			{
				var arg = arguments[0]
				if (isObject(arg))
				{
					notification = arg
					redirect = (arg.redirect === undefined) ? redirect : arg.redirect
				}
				else
				{
					notification = {
						message: arg + '',
					}
				}
			}
			else if (argc > 1)
			{
				notification = {
					type: 		arguments[0] + '',
					message: 	arguments[1] + '',
				}
				redirect = (arguments[2] === undefined) ? redirect : arguments[2]
			}
			else
			{
				return
			}

			if (notification) req.session[SESSION_NAME].push(notification)
			
			if (redirect)
			{
				var redirectUrl = (typeof redirect === 'string') ? redirect : req.originalUrl
				res.redirect(redirectUrl)
			}
		}

		// Check if there are any messages in session to render
		if (req.session[SESSION_NAME].length)
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
					if (err) throw err
					req.session[SESSION_NAME].length = 0
					AFTER_ALL_RENDER(resultHTML, function(err, html){
						if (err) throw err
						res.locals[LOCALS_NAME] = html
						next()						
					})
				}
			)
		}
		else
		{
			next()	
		}
	}

	return Middleware 
}

module.exports = ConnectMiddleware
