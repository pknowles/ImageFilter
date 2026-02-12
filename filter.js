
//FIXME: video filters are being added with the same id

function ImageFilter(sources, enabled, initialCustomValues, inverted, histogram) {
	this.enabled = enabled;
	this.animatedHistogramRegex = /%([0-9]*)LH([RGBY])/g;
	this.histogramRegex = /%([0-9]*)(L?)H([RGBY])/g;
	this.variableRegex = /\{\{([^\}]*V[1-3][^\}]*)\}\}/g;
	this.requiresAnimatedHistogram = false;
	this.requiresHistogram = false;
	this.requiresVariables = false;
	this.sources = sources;
	this.histogram = histogram;
	this.inverted = inverted;
	this.source = this.chooseSource(this.sources);
	this.id = this.createUniqueName();
	this.styleid = this.id + '-style';
	this.styleName = this.id;
	this.customValue = {}; //e.g. {V1: 0.8, V2: 0.2}
	for (var k in initialCustomValues)
		this.customValue[k] = initialCustomValues[k];
	this.update();
}

ImageFilter.prototype.release = function() {
	console.log("Haven't implemented ImageFilter.release()");
};

ImageFilter.prototype.invert = function(enable) {
	if (this.inverted != enable)
	{
		this.inverted = enable;
		this.update();
	}
}

ImageFilter.prototype.setCustomValue = function(key, value) {
	if (!(key in this.customValue) || this.customValue[key] !== value)
	{
		this.customValue[key] = value;

		//update if variables are used
		if (this.requiresVariables)
			this.update();
	}
}

ImageFilter.prototype.getInfo = function() {
	return "Enabled: " + this.enabled + "<br/>" +
		"Fallback Index: " + this.sourceIndex + "<br/>";
}

ImageFilter.prototype.update = function(sources) {
	var that = this;
	if (sources)
		this.sources = sources;
	this.source = this.chooseSource(this.sources);

	// Replace histogram patterns - must always happen to avoid invalid SVG attributes
	if (this.histogram && this.histogram.success)
	{
		var lh = this.histogram.lastHistogram;
		var h = this.histogram.histogram;
		this.source = this.source.replace(this.histogramRegex, function(matches, blockSize, last, channelChar) {
			last = last.length > 0;
			var channel = "RGBY".indexOf(channelChar);
			blockSize = Math.max(1, blockSize.length ? parseFloat(blockSize) : 1);
			if (blockSize > 0 && channel >= 0)
				return that.histogram.getData(channel, that.histogram.animated && last, blockSize);
			else
				return "0 1";
		});
		// Also handle animated histogram patterns (must come after regular histogram regex)
		this.source = this.source.replace(this.animatedHistogramRegex, function(matches, blockSize, channelChar) {
			var channel = "RGBY".indexOf(channelChar);
			blockSize = Math.max(1, blockSize.length ? parseFloat(blockSize) : 1);
			if (blockSize > 0 && channel >= 0 && that.histogram.animated)
				return that.histogram.getData(channel, true, blockSize);
			else
				return "0 1";
		});
	} else {
		// Histogram not ready - replace histogram patterns with default linear values
		// Use "0 1" which represents a linear mapping (no change)
		this.source = this.source.replace(this.histogramRegex, function() {
			return "0 1";
		});
		this.source = this.source.replace(this.animatedHistogramRegex, function() {
			return "0 1";
		});
	}

	// Replace variables regardless of histogram status
	this.source = this.source.replace(this.variableRegex, function(m, equation){
		equation = equation.replace(/(V[1-3])/g, function (m, i) {return that.customValue[i];});
		//return eval(equation);
		var result = that.safeEval(equation);
		// Ensure we return a valid number, fallback to 0 if parsing failed
		if (typeof result !== 'number' || isNaN(result)) {
			console.warn('safeEval failed for equation:', equation, 'result:', result);
			return 0;
		}
		return result;
	});

	/*
	filterString = filterString.replace(/%\(([^\)]*V[1-3][^\)]*)\)/g, function(m, equation){
		equation = equation.replace(/V([1-3])/g, function (m, i) {return options.get("value" + i);});
		return eval(equation);
	});
	*/

	var invertSource = this.inverted ? '\n<feColorMatrix type="matrix" values="-1 0 0 0 1 0 -1 0 0 1 0 0 -1 0 1 0 0 0 1 0"/>\n' : '';

	var svg = '<svg xmlns="http://www.w3.org/2000/svg" version="1.1" height="0"><filter id="' + this.id +
		'" color-interpolation-filters="sRGB" x="0%" y="0%" width="100%" height="100%">' + this.source + invertSource +
		'</filter></svg>';
	var existing = $('#' + this.id);
	if (existing.length)
		existing.parent().replaceWith(svg)
	else
		$(document.body).append($(svg));

	this.enable(this.enabled);
}

// Safe expression evaluator to replace eval() for Manifest V3 CSP compliance
// Handles simple arithmetic expressions: numbers, +, -, *, /, parentheses, unary minus
ImageFilter.prototype.safeEval = function(expression) {
	// Remove whitespace
	expression = expression.replace(/\s/g, '');

	// Simple recursive descent parser for arithmetic expressions
	var pos = 0;

	function parseNumber() {
		var start = pos;
		if (pos < expression.length && expression[pos] === '-') {
			pos++;
		}
		while (pos < expression.length && /[\d.]/.test(expression[pos])) {
			pos++;
		}
		if (pos > start) {
			return parseFloat(expression.substring(start, pos));
		}
		return null;
	}

	function parseFactor() {
		if (pos >= expression.length) return null;

		if (expression[pos] === '-') {
			pos++;
			var value = parseFactor();
			return value !== null ? -value : null;
		}

		if (expression[pos] === '(') {
			pos++;
			var value = parseExpression();
			if (expression[pos] === ')') {
				pos++;
				return value;
			}
			return null;
		}

		return parseNumber();
	}

	function parseTerm() {
		var value = parseFactor();
		if (value === null) return null;

		while (pos < expression.length) {
			if (expression[pos] === '*') {
				pos++;
				var right = parseFactor();
				if (right === null) return null;
				value *= right;
			} else if (expression[pos] === '/') {
				pos++;
				var right = parseFactor();
				if (right === null) return null;
				value /= right;
			} else {
				break;
			}
		}
		return value;
	}

	function parseExpression() {
		var value = parseTerm();
		if (value === null) return null;

		while (pos < expression.length) {
			if (expression[pos] === '+') {
				pos++;
				var right = parseTerm();
				if (right === null) return null;
				value += right;
			} else if (expression[pos] === '-') {
				pos++;
				var right = parseTerm();
				if (right === null) return null;
				value -= right;
			} else {
				break;
			}
		}
		return value;
	}

	var result = parseExpression();
	return result !== null ? result : 0;
}

ImageFilter.prototype.enable = function(enabled) {
	this.enabled = enabled;
	var filterURL = "url('#" + this.id + "')";
	var styleString = enabled ? "-webkit-filter: "+filterURL+"; -moz-filter: "+filterURL+"; -ms-filter: "+filterURL+"; -o-filter: "+filterURL+"; filter: "+filterURL+";" : "";
	var style = '<style id=' + this.styleid + '>\n.' + this.styleName + ' {' + styleString + '}\n</style>';
	var existing = $('#' + this.styleid);
	if (existing.length)
		existing.replaceWith(style)
	else
		$(document.body).append($(style));
}

ImageFilter.prototype.remove = function() {
	$('#' + this.id).remove();
};

ImageFilter.prototype.chooseSource = function(sources) {
	for (var i in sources)
	{
		this.sourceIndex = i;
		var source = sources[i];
		this.requiresAnimatedHistogram = source.match(this.animatedHistogramRegex);
		this.requiresHistogram = source.match(this.histogramRegex);
		this.requiresVariables = source.match(this.variableRegex);
		if (this.requiresHistogram && (!this.histogram || !this.histogram.success))
			continue;
		if (this.requiresAnimatedHistogram && !this.histogram.animated)
			continue;
		break;
	}
	return source;
}

ImageFilter.prototype.createUniqueName = function() {
	if (typeof ImageFilter.prototype.createUniqueName.nextID == 'undefined') {
		ImageFilter.prototype.createUniqueName.nextID = 0;
	}
	var name = '';
	if (this.histogram)
	{
		var e = this.histogram.element;
		if (e)
			name = e.nodeName + '-';
		if (this.histogram.src)
	 		name += this.histogram.src.match("[^/]+$")[0].replace(/[^A-Za-z0-9_\-]+/g, "");
		else if (e && e.id && e.id.length)
			name += e.id;
		else if (e && e.className && e.className.length)
			name += e.className;
		else
			name += 'unknown';
	}
	else
		name += 'default';
	if (name.length > 32)
		name = name.substring(0,32);
	return 'imagefilter' + (ImageFilter.prototype.createUniqueName.nextID++) + '-' + name;
}
