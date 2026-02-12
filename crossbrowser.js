

function getActiveTabURL(callback)
{
	if (typeof chrome !== 'undefined')
	{
		chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
			if (chrome.runtime.lastError) {
				console.warn('Error getting active tab URL:', chrome.runtime.lastError.message);
				callback(null);
				return;
			}
			if (tabs && tabs.length > 0 && tabs[0].url) {
				callback(tabs[0].url);
			} else {
				callback(null);
			}
		});
	}
	else
	{
		//firefox
		callback(tabs.activeTab.url);
	}
}

function openOptions()
{
	if (typeof chrome !== 'undefined')
	{
		//yay chrome :D
		if (typeof chrome.runtime.openOptionsPage == 'function')
		{
			chrome.runtime.openOptionsPage();
			console.log(chrome.runtime.lastError);
		}
		else
		{
			var optionsUrl = chrome.runtime.getURL('options.html');
			chrome.tabs.query({url: optionsUrl}, function(tabs) {
				if (tabs.length) {
					chrome.tabs.update(tabs[0].id, {active: true});
				} else {
					chrome.tabs.create({url: optionsUrl});
				}
			});
		}
	}
	else
	{
		console.error("1");
		//firefox... :(
		//FIXME: hard coded, but don't have access to require() so wahtever
		window.open('resource://imagefilter/options.html', '_newtab');
		//tabs.open('resource://imagefilter/options.html');
	}
}
