
//TODO: handle filter removal

var activeURL = null;
var activeHostname = null;

//helper function to catch events given a selector (avoid pulling in jquery)
function ev(selector, event, handler)
{
	var elements = document.querySelectorAll(selector);
	for (var i = 0; i < elements.length; ++i)
		elements[i].addEventListener(event, handler);
}

function getHostname(url)
{
	var parser = document.createElement('a');
	parser.href = url;
	return parser.hostname;
}

function parseSiteKey(key)
{
	var match = key.match(/^site-(enable|filter)(-(.+))?$/);
	if (match)
	{
		if (activeHostname == match[3])
			return "site-" + match[1];
		else
			return null;
	}
	return key;
}

function applyOption(key, value)
{
	key = parseSiteKey(key)
	if (!key)
		return;

	var filter = key.match(/^filter-(.*)$/);
	if (filter)
	{
		var lists = document.querySelectorAll('.filterlist');
		for (var i = 0; i < lists.length; ++i)
		{
			var e = document.createElement('option');
			e.text = filter[1];
			e.value = filter[1];
			lists[i].appendChild(e);
		}
		return;
	}

	var e = document.querySelector('*[name="' + key + '"]');
	if (e)
	{
		if (e.type == 'checkbox')
			e.checked = value;
		else
			e.value = value;

		if (key.match(/^site-/))
		{
			if (value === null)
				e.parentNode.className = e.parentNode.className.replace(/\b.override\b/,'');
			else if (e.parentNode.className.indexOf('override') === -1)
				e.parentNode.className += ' override';
		}
	}
}

function sendOption(key, value)
{
	if (key.match(/^site-.*$/))
		key = key + "-" + activeHostname;

	mylogger.log('popup sets ' + key + '=' + value + ' - ' + encodeURI(activeURL));

	//saving the option
	if (value !== null)
	{
		var data = {};
		data[key] = value;
		mystorage.set(data);
	}
	else
		mystorage.remove(key);

	//send to all tabs
	var data = {key:key, value:value};
	mymessages.sendTabs(data);

	//finally, make sure the option page is displaying the right thing
	applyOption(key, value);
}

mymessages.listen(function(request){
	var re = /^[a-z-]+$/;
	if (re.test(request.key))
		applyOption(request.key, request.value);
});

document.addEventListener('DOMContentLoaded', function(){
	ev('.option', 'change', function(event){
		var e = event.target;
		if (e.type === 'checkbox')
			sendOption(e.name, e.checked);
		else
			sendOption(e.name, e.value);
	});
	ev('#clear-overrides', 'click', function(e){
		var elements = document.querySelectorAll("#site-specific input, #site-specific select");
		for (var i = 0; i < elements.length; ++i)
			sendOption(elements[i].name, null);
	});
	ev('#open-options', 'click', function(e){
		openOptions();
		e.preventDefault();
		return false;
	});
});

function onLoad()
{
	getActiveTabURL(function(url) {
		if (!url) {
			// If we can't get the URL, use a default
			activeURL = '';
			activeHostname = '';
		} else {
			activeURL = url;
			activeHostname = getHostname(url);
		}

		mystorage.all(function(items){
			for (var key in items)
				if (key.match(/^filter.*$/))
					applyOption(key, items[key]);

			var selects = document.getElementsByTagName('select');
			for (var i = 0; i < selects.length; ++i)
				selects[i].selectedIndex = -1;

			for (var key in items)
				if (!key.match(/^filter.*$/))
					applyOption(key, items[key]);
		});
	});
}

window.onload = onLoad;
