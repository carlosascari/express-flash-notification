# express-flash-notification

This module provides a way to set one-time notifications to be displayed after processing a request. Notifications are stored in session and are removed once they have been displayed.

**Key Points**

* Template Engine Agnostic, works with any engine you are using logic/logicless
* Supports for Multiple notifications to be sent
* Auto refreshes the page to display the notification
* Allows you to manipulate the notification output before and after it has been created

### Why?

`connect-flash` is nice if your template engine can do some conditional logic like EJS however,  if you are using a logic-less engine, like `hogan-express` things get akward IMO.

I needed something simple like: 

`req.flash('info', 'my message')` in my controller/middleware and
`{{{flash}}}` in my layout

Then the HTML for each alert gets placed in `{{{flash}}}` including some client side javascript so it doesn't just appear `$(elm).slideDown()` **FTW**

While at the same time, adding the markup nessary to display the alert depending on its **type** (so info is blue, error is red, etc)

## Install

$ npm install express-flash-notification --save

## Usage

Flash notifications are stored in the session. You will need the `cookieParser` middleware and the `session` middleware. Depending on your express version it may be bundled in express  or for the newer releases you'll have to npm install them as seperate modules. I'm using express 4.x

You must pass the express application instance as the first argument in  the `flash()` middleware so `app.render` can be used to create your notification using your template engine and views directory

```javascript
var flash 			= require('express-flash-notification')
var cookieParser	= require('cookie-parser')
var session			= require('express-session')

var app = express()

// setup views directory, view engine, etc...

app.use(cookieParser())
app.use(session({...}}))
app.use(flash(app))
```

With the `flash` middleware in place, all requests will have a `req.flash()` function that can be used for flash notifications.

```javascript
app.use('/login', function loginProcessor(req, res, next){
	if (req.method !== 'POST') return next()
	if (!req.body) return next(new Error('no data was sent to the server, please try again'))
	
	var user = req.body.user
	var pass = req.body.pass

	if (user && pass)
	{
		if (user === 'root' && pass === 'toor')
		{
			res.redirect('/dashboard')
		}
		else
		{
			req.flash('info', 'invalid username or password')
		}
	}
	else
	{
		req.flash('info', 'you must enter your username and password to login')
	}
})

app.use('/login', function loginErrorHandler(err, req, res, next){
	if (err.message)
	{
		req.flash('error', err.message)
	}
	else
	{
		console.log('there was a nasty login error: %s', err.stack)
		next()
	}
})

app.get('/login', function loginRenderer(req, res, next){
	res.render('external', {
		partials: {
			content: 'external/login'
		}
	})	
})
```

By default, req.flash will redirect to the current url, effectively refreshing the page so to display the flash notification. It's important that your logic uses `return` when using flash or contraints so you don't get the *headers have already been sent* error. 
For example below, if 2 + 2 ever equals 'fish' the `req.flash` method will send out the redirect headers, and execution will continue until the `next` function is called, `next` will also try to set the response headers

```javascript
app.use('/get-busy', function(req, res, next){
 	if (2 + 2 === 'fish')
 	{
 		req.flash('error', 'fairies!')
 	}
	
 	// ... other logics go here
 	next()
})
```

In the case above, and in case you want to send multiple notifications you can disable the redirect by setting the third parameter to `false`
You can also set a string and that will become the destination for the redirect

```javascript
app.use('/get-busy', function(req, res, next){
 	if (2 + 2 === 'fish')
 	{
 		return req.flash('error', 'fairies!', '/impossible')
 	}
	
 	// ... other logics go here
 	req.flash('success', 'logics are done', false)
 	next()
})
```

##### Using req.flash

A notification is basically an object where its properties become the local variables when rendering the notification

- req.flash(*String*)
  Sets local variable `message` to the string provided, `type` will become an empty string. Will refresh page

- req.flash(*String*, *String*)
  First string is the `type` local variable, the second is the `message` local variable. Will refresh page.

- req.flash(*String*, *String*, *Boolean*)
  Same as above. Third variable as a boolean decides whether or not to refresh the page.

- req.flash(*String*, *String*, *String*)
  Similar to to above, except last argument as a string defines which page to redirect to

- req.flash(*object*)
  You can pass an object as the first argument, the object's properties will be exposed as local variables when rendering the notification template.
  The property `redirect` is reserved and functions just as you'd expect; a Boolean determines if it will refresh, or as a String you specify where to redirect to.

  `req.flash('info', 'if cats ruled the world', false)` is treated exactly the same as
  `req.flash({
    type: 'info',
    message: 'if cats rules the world',
    redirect: false
  })`


##### In your Layout

Wherever you place the local variable `flash`, it will be populated with the notifications if there are any. Make sure it does not escape, as the output will  be HTML

##### In your Views

By default, a view called `flash` in your `views` directory will be retrieved and used as the default template for your notifications.
The local variables `type` and `message` will be set.

**flash.html** (I'm using mustache in this example)

```html
<div class="alert flash">
	<button type="button" class="close">×</button>
	<i class="fa sign"></i><strong>{{type}}</strong> 
	<span>{{message}}</span>
</div>
```

----------------

## Advance Configuration

When setting the flash middleware, the second parameter accepts an object for configuration
Below is an example with all the options set to their defaults

```javascript
app.use(flash(app, {
	session_name: 	'flash',
	utility_name: 	'flash',
	locals_name: 	'flash',
	view_name: 		'flash',
	beforeSingleRender: function(item, callback){callback(null, item)},
	afterAllRender: function(htmlFragments, callback){callback(null, htmlFragments.join('\n'))}
}))
```

- **session_name** Is the key used to store the notifications in session: `req.session[session_name]`

- **utility_name** Is the name of the function that is exposed in the `req` object, the one used to add new notifications: `req[utility_name]('info', 'hello')`

- **locals_name** Is the `locals` variable name where all your notifications will be placed, make sure it does not escape HTML: `{{{locals_name}}}`

- **view_name** Is the name of the view that will be used as the template for all notifications: `app/views/view_name.html`

- **beforeSingleRender** Is called right before each notification is rendered, allowing you to add/remove or modify the local variables passed to the renderer.
The first argument is an object with all the locals variables set, typically you will find `item.type` and `item.message` here. The second argument is a callback that must be called with `null` or an `Error` for the first parameter, and an object with the locals used to render on the second parameter.

- **afterAllRender** Is called after all notifications have been compiled. Allowing you to append anything like extra HTML to the output.
The first argument, is an array with each rendered notification. The second argument is a callback that must be called with `null` or an `Error` for the first parameter, and the resulting notifications output **not as an Array but as a String** (Array.join)

## Advance Usage

Heres an example where custom notifications will be rendered, `beforeSingleRender` is used to add class names depending on the `type` of notification
so the resulting notification looks different depending on its type. Also, `afterAllRender` will be used to append some javascript so notification
don't just appear, they slide into view.

**NOTE** `{{{flash}}}` is placed in my layout template, not shown here

This is my `flash.html` view template.
`alert_class` and `icon_class` will be populated inside of `beforeSingleRender`
`style="display: none"` is set so the appended javascript uses jQuery's slideDown method to animate its presentation

```html
<div class="alert flash {{alert_class}}" style="display:none">
	<button type="button" class="close">×</button>
	<i class="fa {{icon_class}} sign"></i><strong>{{type}}</strong> 
	<span>{{message}}</span>
</div>
```

This is the setup

```javascript

app.use(require('express-flash-notification')(app, {
	view_name: 		'elements/flash',
	beforeSingleRender: function(item, callback)
	{
		if (item.type)
		{
			switch(item.type)
			{
				case 'error':
					item.alert_class = 'alert-danger'
					item.icon_class = 'fa-times-circle'
				break;
				case 'alert':
					item.alert_class = 'alert-warning'
					item.icon_class = 'fa-times-circle'
				break;
				case 'info':
					item.alert_class = 'alert-info'
					item.icon_class = 'fa-times-circle'
				break;
				case 'success':
					item.alert_class = 'alert-success'
					item.icon_class = 'fa-check'
				break;
				case 'ok':
					item.alert_class = 'alert-primary'
					item.icon_class = 'fa-check'
				break;
			}
		}

		callback(null, item)
	},
	afterAllRender: function(htmlFragments, callback)
	{
		// Naive JS is appened, waits a while expecting for the DOM to finish loading in 200ms,
		// The timeout can be removed if jOuery is loaded before this is called
		htmlFragments.push([
			'<script type="text/javascript">',
			'	setTimeout(function(){',
			'		$(".alert.flash").slideDown().find(".close").on("click", function(){$(this).parent().hide()})',
			'	}, 200)',
			'</script>',
		].join(''))

		callback(null, htmlFragments.join(''))
	},
}))

```

And this is how I use it

```javascript
app.use('/bleh/:ok', function(req, res, next){
	if (req.params.ok)
	{
		req.flash('ok', 'Everything is A-O-K')
	}
	else
	{
		req.flash('warn', 'Quick! everybody panic!')
	}
})
```

## License

[The MIT License](http://opensource.org/licenses/MIT)