
//TODO: dynamically disable context menu when it's not applicable. the API is terrible
//TODO: handle filter addition and removal

mymessages.listen(function(request, sender){
	//content scripts can't update filters. security risk?
	if (request.key.match(/^filter.*$/))
		return;

	if (sender)
	{
		mylogger.log('shortcut sets ' + request.key + '=' + request.value + ' - ' + encodeURI(sender.tab.url));
	}

	//save the option
	var data = {};
	data[request.key] = request.value;
	mystorage.set(data, function(){
		//broadcast to all pages
		mymessages.sendTabs(request);
	});
});

if (typeof chrome !== 'undefined')
{
	//FIXME: need to clear all menus first in case of background script reload
	var filterList = chrome.contextMenus.create({id: 'filterList', title: 'Override Filter', contexts: ['all']});
	var filterListNames = {};
	var zoomList = chrome.contextMenus.create({id: 'zoomList', title: 'Zoom', contexts: ['all']});
	var zoomSizes = {};
	var clearFilter = chrome.contextMenus.create({id: 'clearFilter', title: 'Clear Override', contexts: ['all']});

	// Use Manifest V3 context menu API
	chrome.contextMenus.onClicked.addListener(function(info, tab) {
		if (filterListNames[info.menuItemId]) {
			// Filter menu item clicked
			var name = filterListNames[info.menuItemId];
			chrome.tabs.sendMessage(tab.id, {contextMenuClick: 'filter', name: name});
		} else if (zoomSizes[info.menuItemId] !== undefined) {
			// Zoom menu item clicked
			var ratio = zoomSizes[info.menuItemId];
			chrome.tabs.sendMessage(tab.id, {contextMenuClick: 'zoom', ratio: ratio});
		} else if (info.menuItemId === 'clearFilter') {
			// Clear filter menu item clicked
			chrome.tabs.sendMessage(tab.id, {contextMenuClick: 'clearfilter'});
		}
	});

	function createFilterMenuItem(name)
	{
		var id = 'filter-' + name;
		// Remove existing menu item if it exists to avoid duplicate ID error
		chrome.contextMenus.remove(id).catch(() => {})
		chrome.contextMenus.create({id: id, title: name, parentId: filterList, contexts: ['all']});
		filterListNames[id] = name;
	}

	function createZoomSize(ratio)
	{
		var id = 'zoom-' + ratio;
		chrome.contextMenus.create({id: id, title: ratio + '×', parentId: zoomList, contexts: ['all']});
		zoomSizes[id] = ratio;
	}

	createZoomSize(1);
	createZoomSize(2);
	createZoomSize(4);

	assertDefaultsAreLoaded(function(){
		mystorage.all(function(items){
			for (var key in items)
			{
				var match = key.match(/^filter-(.*)$/);
				if (match)
					createFilterMenuItem(match[1]);
			}
		});
	});
}
else
{
	//firefox
	//nah
}
