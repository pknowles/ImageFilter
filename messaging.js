var mymessages = {};

(function(){
	if (typeof chrome !== 'undefined')
	{
		mymessages.sendBacgkround = chrome.runtime.sendMessage;
		mymessages.sendTabs = function(message){
			chrome.tabs.query({}, function(tabs) {
				for (var i=0; i < tabs.length; ++i) {
					chrome.tabs.sendMessage(tabs[i].id, message, function(response) {
						// Ignore errors - some tabs may not have content scripts loaded
						if (chrome.runtime.lastError) {
							// Silently ignore connection errors
						}
					});
				}
			});
		};
		mymessages.listen = function(callback){
			chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
				callback(request, sender);
			});
		};
	}
	else
	{
		//var self = self || addon;

		mymessages.sendBacgkround = function (message) {
			if (self.port)
				self.port.emit('mymessage', message);
			//else if (self.sendMessage)
			//	self.sendMessage(message);
			else
				console.error("Error: cannot send messages");
		};
		mymessages.sendTabs = function(message){
			//lol no. so not implementing that
			//https://stackoverflow.com/questions/17778772/how-to-implement-chrome-extension-s-chrome-tabs-sendmessage-api-in-firefox-addo
			console.error("Not implemented");
		};
		mymessages.listen = function(callback){
			if (self.port)
				self.port.on('mymessage', callback);
			//else if (self.onmessage)
			//	self.onmessage(callback);
			//else if (self.on)
			//	self.on(callback);
			else
				console.error("Error: cannot receive messages");
		};
	}
})();
