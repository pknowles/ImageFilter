
function Histogram(source, element, updateInterval) {
	this.maxHistogramSampleDimension = 128; //if image is bigger than this, scale down before generating the histogram
	this.attempts = 4; //try this many times to generate a histogram and then give up

	this.histogram = [];
	this.lastHistogram = [];
	this.src = source;
	this.element = element;
	this.updateInterval = updateInterval;
	this.animated = this.element && this.updateInterval > 0;
	this.success = false;
	this.ready = false;
	this.onload = null;
	this.onupdate = null;
	this.timer = null;
	if (this.animated)
	{
		this.drawObject = element;
		window.setTimeout(this.loaded.bind(this), 100);
	}
	else
	{
		this.drawObject = new Image();
		var that = this;
		this.drawObject.onload = this.loaded.bind(this);
		this.drawObject.src = this.src;
	}
}

Histogram.prototype.stop = function() {
	window.clearInterval(this.timer);
};

Histogram.prototype.getImagePixels = function(drawable) {
	if (typeof Histogram.prototype.getImagePixels.tempCanvas == 'undefined') {
		Histogram.prototype.getImagePixels.tempCanvas = null;
	}

	try {
		if (!Histogram.prototype.getImagePixels.tempCanvas)
			Histogram.prototype.getImagePixels.tempCanvas = document.createElement("canvas");

		var scale = 1.0 / Math.max(Math.max(
			drawable.naturalWidth / this.maxHistogramSampleDimension,
			drawable.naturalHeight / this.maxHistogramSampleDimension
			), 1.0);
		Histogram.prototype.getImagePixels.tempCanvas.width = drawable.naturalWidth * scale;
		Histogram.prototype.getImagePixels.tempCanvas.height = drawable.naturalHeight * scale;

		var canvasContext = Histogram.prototype.getImagePixels.tempCanvas.getContext("2d");
		canvasContext.drawImage(drawable, 0, 0, drawable.clientWidth, drawable.clientHeight, 0, 0, Histogram.prototype.getImagePixels.tempCanvas.width, Histogram.prototype.getImagePixels.tempCanvas.height);
		var pixels = canvasContext.getImageData(0, 0, canvasContext.canvas.width, canvasContext.canvas.height);
		return pixels;
	}
	catch (e) {
		Histogram.prototype.getImagePixels.tempCanvas = null; //canvas is tainted. can't use it any more
		console.log(e);
		return null;
	}
};

Histogram.prototype.updateHistogram = function(drawable) {
	var pixels = this.getImagePixels(drawable);
	if (!pixels)
		return false;

	var data = pixels.data;

	this.lastHistogram = this.histogram;

	//initialize arrays
	var channels = 4;
	var h = [];
	var i, c;
	for (i = 0; i < 256 * channels; ++i)
		h[i] = 0;

	//compute histogram h
	var n = pixels.width * pixels.height;
	var scale = 1.0/(n-1);
	var total = [0, 0, 0];
	for (i = 0; i < n; ++i)
	{
		//channel 0, 1, 2 = rgb
		for (c = 0; c < 3; ++c)
			h[data[i*4+c]*channels+c] += scale;

		//channel 3 = luminance
		var y = 0.299 * data[i*4+0] + 0.587 * data[i*4+1] + 0.114 * data[i*4+2];
		h[Math.floor(y)*channels+3] += scale;
	}

	//integrate h into this.histogram
	for (c = 0; c < channels; ++c)
		total[c] = 0;
	for (i = 0; i < 256; ++i)
		for (c = 0; c < channels; ++c)
			total[c] = this.histogram[c*256+i] = total[c] + h[i*channels+c];

	//if this is the first update, set the last to the current
	if (this.lastHistogram.length != this.histogram.length)
		this.lastHistogram = this.histogram;

	return true;
};

Histogram.prototype.loaded = function() {
	this.success = this.updateHistogram(this.drawObject);
	this.attempts -= 1;
	if (!this.success && this.attempts > 0)
	{
		window.setTimeout(this.loaded.bind(this), 1000);
		return;
	}

	this.ready = true;

	if (this.onload)
		this.onload(this);

	if (this.animated)
		this.timer = window.setInterval(this.update.bind(this), updateInterval);
};

Histogram.prototype.update = function() {
	this.updateHistogram(this.drawObject);
	if (this.onupdate)
		this.onupdate(this);
};
