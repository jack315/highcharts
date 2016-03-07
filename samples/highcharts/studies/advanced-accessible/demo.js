$(function () {

    // Plugin for increasing chart accessibility
    (function (H) {
        H.Chart.prototype.callbacks.push(function (chart) {
            var options = chart.options,
                acsOptions = options.accessibility || {},
                series = chart.series,
                numSeries = series.length,
                numXAxes = chart.xAxis.length,
                numYAxes = chart.yAxis.length,
                titleElement = document.createElementNS('http://www.w3.org/2000/svg', 'title'),
                descElement = chart.container.getElementsByTagName('desc')[0],
                textElements = chart.container.getElementsByTagName('text'),
                titleId = 'highcharts-title-' + chart.index,
                descId = 'highcharts-desc-' + chart.index,
                tableId = 'highcharts-data-table-' + chart.index,
                oldColumnHeaderFormatter = options.exporting && options.exporting.csv && options.exporting.csv.columnHeaderFormatter,
                topLevelColumns = [],
                chartTitle = options.title.text || 'Chart',
                hiddenSection = document.createElement('div'),
                hiddenSectionContent = '',
                tableShortcut = document.createElement('h3'),
                tableShortcutAnchor = document.createElement('a'),
                xAxisDesc,
                yAxisDesc,
                chartTypes = [],
                chartTypeDesc,
                // Descriptions for exotic chart types
                typeDescriptionMap = {
                    boxplot: ' Box plot charts are typically used to display groups of statistical data. ' +
                             'Each data point in the chart can have up to 5 values: minimum, lower quartile, median, upper quartile and maximum. ',
                    arearange: ' Arearange charts are line charts displaying a range between a lower and higher value for each point. ',
                    areasplinerange: ' These charts are line charts displaying a range between a lower and higher value for each point. ',
                    bubble: ' Bubble charts are scatter charts where each data point also has a size value. ',
                    columnrange: ' Columnrange charts are column charts displaying a range between a lower and higher value for each point. ',
                    errorbar: ' Errorbar series are used to display the variability of the data. ',
                    funnel: ' Funnel charts are used to display reduction of data in stages. ',
                    pyramid: ' Pyramid charts consist of a single pyramid with item heights corresponding to each point value. ',
                    waterfall: ' A waterfall chart is a column chart where each column contributes towards a total end value. '
                },
                // Human readable description of series and each point in singular and plural
                typeToSeriesMap = {
                    'default': ['series', 'data point', 'data point'],
                    'line': ['line', 'data point', 'data points'],
                    'spline': ['line', 'data point', 'data points'],
                    'area': ['line', 'data point', 'data points'],
                    'areaspline': ['line', 'data point', 'data points'],
                    'pie': ['pie', 'slice', 'slices'],
                    'column': ['column series', 'column', 'columns'],
                    'bar': ['bar series', 'bar', 'bars'],
                    'scatter': ['scatter series', 'data point', 'data points'],
                    'boxplot': ['boxplot series', 'box', 'boxes'],
                    'arearange': ['arearange series', 'data point', 'data points'],
                    'areasplinerange': ['areasplinerange series', 'data point', 'data points'],
                    'bubble': ['bubble series', 'bubble', 'bubbles'],
                    'columnrange': ['columnrange series', 'column', 'columns'],
                    'errorbar': ['errorbar series', 'errorbar', 'errorbars'],
                    'funnel': ['funnel', 'data point', 'data points'],
                    'pyramid': ['pyramid', 'data point', 'data points'],
                    'waterfall': ['waterfall series', 'column', 'columns']
                },
                yValueDesc,
                commonKeys = ['name', 'id', 'category', 'x', 'value', 'y'],
                specialKeys = ['z', 'open', 'high', 'q3', 'median', 'q1', 'low', 'close'],
                yKeys = specialKeys.concat(['y']),
                yValues = [],
                i;

            if (!acsOptions.enabled) {
                return;
            }

            // Add SVG title/desc tags
            titleElement.textContent = chartTitle;
            titleElement.id = titleId;
            descElement.parentNode.insertBefore(titleElement, descElement);
            chart.renderTo.setAttribute('role', 'region');
            chart.renderTo.setAttribute('aria-label', chartTitle);

            // Set attribs on context menu
            function setContextMenuAttribs() {
                var exportList = chart.exportDivElements;
                if (exportList) {
                    // Set tabindex on the menu items to allow focusing by script
                    // Set role to give screen readers a chance to pick up the contents
                    for (var i = 0; i < exportList.length; ++i) {
                        if (exportList[i].tagName === 'DIV' &&
                            !(exportList[i].children && exportList[i].children.length)) {
                            exportList[i].setAttribute('role', 'menuitem');
                            exportList[i].setAttribute('tabindex', -1);
                        }
                    }
                    // Set accessibility properties on parent div
                    exportList[0].parentNode.setAttribute('role', 'menu');
                    exportList[0].parentNode.setAttribute('aria-label', 'Chart export');
                }
            }

            // Set screen reader properties on menu parent div
            if (chart.exportSVGElements && chart.exportSVGElements[0] && chart.exportSVGElements[0].element) {
                var oldExportCallback = chart.exportSVGElements[0].element.onclick;
                chart.exportSVGElements[0].element.onclick = function () {
                    oldExportCallback.apply(this, Array.prototype.slice.call(arguments));
                    setContextMenuAttribs();
                };
                chart.exportSVGElements[0].element.setAttribute('role', 'button');
                chart.exportSVGElements[0].element.setAttribute('aria-label', 'Chart export menu');
            }

            // Get label for axis (x or y)
            function getAxisLabel(axis) {
                return axis.userOptions && axis.userOptions.description || axis.axisTitle && axis.axisTitle.textStr ||
                        axis.options.id || axis.categories && 'categories' || 'Undeclared';
            }

            // Hide text elements from screen readers
            for (i = 0; i < textElements.length; ++i) {
                textElements[i].setAttribute('aria-hidden', 'true');
            }

            // Enumerate chart types
            for (i = 0; i < numSeries; ++i) {
                if (chartTypes.indexOf(series[i].type) < 0) {
                    chartTypes.push(series[i].type);
                }
            }

            // Simplify description of chart type. Some types will not be familiar to most screen reader users, but we try.
            if (chartTypes.length > 1) {
                chartTypeDesc = 'Combination chart.';
            } else if (chartTypes[0] === 'spline' || chartTypes[0] === 'area' || chartTypes[0] === 'areaspline') {
                chartTypeDesc = 'Line chart.';
            } else {
                chartTypeDesc = chartTypes[0] + ' chart.' + (typeDescriptionMap[chartTypes[0]] || '');
            }

            // Add axis info - but not for pies. Consider not adding for other types as well (funnel, pyramid?)
            if (!(chartTypes.length === 1 && chartTypes[0] === 'pie')) {
                if (numXAxes) {
                    xAxisDesc = 'The chart has ' + numXAxes + (numXAxes > 1 ? ' X axes' : ' X axis') + ' displaying ';
                    if (numXAxes < 2) {
                        xAxisDesc += getAxisLabel(chart.xAxis[0]) + '.';
                    } else {
                        for (i = 0; i < numXAxes - 1; ++i) {
                            xAxisDesc += (i ? ', ' : '') + getAxisLabel(chart.xAxis[i]);
                        }
                        xAxisDesc += ' and ' + getAxisLabel(chart.xAxis[i]) + '.';
                    }
                }

                if (numYAxes) {
                    yAxisDesc = 'The chart has ' + numYAxes + (numYAxes > 1 ? ' Y axes' : ' Y axis') + ' displaying ';
                    if (numYAxes < 2) {
                        yAxisDesc += getAxisLabel(chart.yAxis[0]) + '.';
                    } else {
                        for (i = 0; i < numYAxes - 1; ++i) {
                            yAxisDesc += (i ? ', ' : '') + getAxisLabel(chart.yAxis[i]);
                        }
                        yAxisDesc += ' and ' + getAxisLabel(chart.yAxis[i]) + '.';
                    }
                }
            }


            /* Add secret HTML section */

            hiddenSection.setAttribute('role', 'region');
            hiddenSection.setAttribute('aria-label', 'Chart screen reader information');

            var chartTypeInfo = series[0] && typeToSeriesMap[series[0].type] || typeToSeriesMap.default;
            hiddenSectionContent = '<p>Use regions/landmarks to skip ahead to chart' +
                (numSeries > 1 ? ' and navigate between data series' : '') + '.</p><h3>Summary</h3><p>' + chartTitle +
                (options.subtitle && options.subtitle.text ? '. ' + options.subtitle.text : '') +
                '</p><h3>Long description</h3><p>' + (acsOptions.description || 'No description available.') + '</p><h3>Structure</h3><p>' +
                (acsOptions.typeDescription || chartTypeDesc) + '</p>' +
                (numSeries === 1 ? '<p>' + chartTypeInfo[0] + ' with ' + series[0].points.length + ' ' +
                    (series[0].points.length === 1 ? chartTypeInfo[1] : chartTypeInfo[2]) + '.</p>' : '') + '<p>' +
                (xAxisDesc ? (' ' + xAxisDesc) : '') +
                (yAxisDesc ? (' ' + yAxisDesc) : '') + '</p>';

            tableShortcutAnchor.innerHTML = 'View as data table';
            tableShortcutAnchor.href = '#tableId';
            tableShortcutAnchor.onclick = function (e) {
                chart.viewData();
                document.getElementById(tableId).focus();
            };
            tableShortcut.appendChild(tableShortcutAnchor);

            hiddenSection.innerHTML = hiddenSectionContent;
            hiddenSection.appendChild(tableShortcut);
            chart.renderTo.insertBefore(hiddenSection, chart.renderTo.firstChild);

            // Shamelessly hide the hidden section
            hiddenSection.style.position = 'absolute';
            hiddenSection.style.left = '-9999em';
            hiddenSection.style.width = '1px';
            hiddenSection.style.height = '1px';
            hiddenSection.style.overflow = 'hidden';


            /* Put info on points and series groups */

            // Return string with information about point
            function buildPointInfoString(point) {
                var infoString,
                    hasSpecialKey = false;

                for (var i = 0; i < specialKeys.length; ++i) {
                    if (point[specialKeys[i]] !== undefined) {
                        hasSpecialKey = true;
                        break;
                    }
                }

                // If the point has one of the less common properties defined, display all that are defined
                if (hasSpecialKey) {
                    H.each(commonKeys.concat(specialKeys), function (key) {
                        var value = point[key];
                        if (value !== undefined) {
                            infoString += '. ' + key + ', ' + value;
                        }
                    });
                } else {
                    // Pick and choose properties for a succint label
                    infoString = (point.name || point.category || point.id || 'x, ' + point.x) + ', ' +
                        (point.value !== undefined ? point.value : point.y);
                }

                return (point.index + 1) + '. ' + infoString + (point.description ? '. ' + point.description : '');
            }

            // Return string with information about series
            function buildSeriesInfoString(dataSeries) {
                var typeInfo = typeToSeriesMap[dataSeries.type] || typeToSeriesMap.default;
                return (dataSeries.name ? dataSeries.name + ', ' : '') +
                    ' series ' + (dataSeries.index + 1) + ' of ' + (dataSeries.chart.series.length) + '. ' +
                    typeInfo[0] + ' with ' +
                    (dataSeries.points.length + ' ' + (dataSeries.points.length === 1 ? typeInfo[1] : typeInfo[2]) + '.') +
                    (dataSeries.description || '') +
                    (numYAxes > 1 && dataSeries.yAxis ? 'Y axis = ' + getAxisLabel(dataSeries.yAxis) : '') +
                    (numXAxes > 1 && dataSeries.xAxis ? 'X axis = ' + getAxisLabel(dataSeries.xAxis) : '');
            }

            function reverseChildNodes(node) {
                var i = node.childNodes.length;
                while (i--) {
                    node.appendChild(node.childNodes[i]);
                }
            }

            // Put info on series and points of a series
            function setSeriesInfo(dataSeries) {
                var firstPointEl = dataSeries.points && dataSeries.points[0].graphic && dataSeries.points[0].graphic.element,
                    seriesEl = firstPointEl && firstPointEl.parentNode; // Could be tracker series depending on series type
                if (seriesEl) {
                    if (numSeries > 1) {
                        seriesEl.setAttribute('role', 'region');
                        seriesEl.setAttribute('tabindex', '-1');
                        seriesEl.setAttribute('aria-label', buildSeriesInfoString(dataSeries));
                    }
                    // For some series types the order of elements do not match the order of points in series
                    if (seriesEl.lastChild === firstPointEl) {
                        reverseChildNodes(seriesEl);
                    }
                }
                H.each(dataSeries.points, function (point) {
                    // Set aria label on point
                    if (point.graphic) {
                        point.graphic.element.setAttribute('role', 'img');
                        point.graphic.element.setAttribute('tabindex', '-1');
                        point.graphic.element.setAttribute('aria-label', acsOptions.pointInfoFormatter && acsOptions.pointInfoFormatter(point) ||
                            buildPointInfoString(point));
                    }
                });
            }
            H.each(series, setSeriesInfo);

            H.wrap(H.Series.prototype, 'drawPoints', function (proceed) {
                proceed.apply(this, Array.prototype.slice.call(arguments, 1));
                setSeriesInfo(this);
            });


            /* Wrap table functionality */

            // Keep track of columns
            options.exporting = H.merge(options.exporting, {
                csv: {
                    columnHeaderFormatter: function (series, key, keyLength) {
                        var prevCol = topLevelColumns[topLevelColumns.length - 1];
                        if (keyLength > 1) {
                            // Populate a list of columns to add in addition to the ones added by the export-csv module
                            // Objects don't preserve order, so use array
                            if ((prevCol && prevCol.text) !== series.name) {
                                topLevelColumns.push({
                                    text: series.name,
                                    span: keyLength
                                });
                            }
                        }
                        if (oldColumnHeaderFormatter) {
                            return oldColumnHeaderFormatter.call(this, series, key, keyLength);
                        }
                        return keyLength > 1 ? key : series.name;
                    }
                }
            });

            // Add ID and title/caption to table HTML
            H.wrap(H.Chart.prototype, 'getTable', function (proceed) {
                return proceed.apply(this, Array.prototype.slice.call(arguments, 1))
                    .replace('<table>', '<table id="' + tableId + '" summary="Table representation of chart"><caption>' + chartTitle + '</caption>');
            });

            // Add accessibility attributes and top level columns
            H.wrap(H.Chart.prototype, 'viewData', function (proceed) {
                if (!this.insertedTable) {
                    proceed.apply(this, Array.prototype.slice.call(arguments, 1));
                    var table = document.getElementById(tableId),
                        body = table.getElementsByTagName('tbody')[0],
                        firstRow = body.firstChild.children,
                        columnHeaderRow = '<tr><th scope="col" aria-hidden="true"></th>',
                        cell,
                        newCell,
                        i;

                    // Make table focusable by script
                    table.setAttribute('tabindex', '-1');

                    // Create row headers
                    for (i = 0; i < body.children.length; ++i) {
                        cell = body.children[i].firstChild;
                        newCell = document.createElement('th');
                        newCell.setAttribute('scope', 'row');
                        newCell.innerHTML = cell.innerHTML;
                        cell.parentNode.replaceChild(newCell, cell);
                    }

                    // Set scope for column headers
                    for (i = 0; i < firstRow.length; ++i) {
                        if (firstRow[i].tagName === 'TH') {
                            firstRow[i].setAttribute('scope', 'col');
                        }
                    }

                    // Add top level columns
                    for (i = 0; i < topLevelColumns.length; ++i) {
                        columnHeaderRow += '<th scope="col" colspan="' + topLevelColumns[i].span + '">' +
                             topLevelColumns[i].text + '</th>';
                    }
                    body.insertAdjacentHTML('afterbegin', columnHeaderRow);
                }
            });


            /* Add keyboard navigation */

            if (acsOptions.keyboardNavigation && acsOptions.keyboardNavigation.enabled === false) {
                return;
            }

            // Make chart reachable by tab
            chart.renderTo.setAttribute('tabindex', '0');

            // Function for highlighting a point
            H.Point.prototype.highlight = function () {
                var point = this,
                    chart = point.series.chart;
                if (point.graphic && point.graphic.element.focus) {
                    point.graphic.element.focus();
                }
                if (!point.isNull) {
                    point.onMouseOver(); // Show the hover marker
                    chart.tooltip.refresh(point); // Show the tooltip
                } else {
                    chart.tooltip.hide(0);
                    // Don't call blur on the element, as it messes up the chart div's focus
                }
                chart.highlightedPoint = point;
            };

            // Function to show the export menu and focus the first item (if exists)
            H.Chart.prototype.showExportMenu = function () {
                var exportList;
                this.exportSVGElements[0].element.onclick();
                exportList = chart.exportDivElements;
                if (exportList) {
                    // Focus first menu item
                    if (exportList[0].focus) {
                        exportList[0].focus();
                    }
                    exportList[0].onmouseover();
                    this.highlightedExportItem = 0; // Keep reference to focused item index
                }
            };

            // Function to highlight next/previous point in chart
            // Returns true on success, false on failure (no adjacent point to highlight in chosen direction)
            H.Chart.prototype.highlightAdjacentPoint = function (next) {
                var series = this.series,
                    curPoint = this.highlightedPoint,
                    newSeries,
                    newPoint;

                // If no points, return false
                if (!series[0] || !series[0].points) {
                    return false;
                }

                // Use first point if none already highlighted
                if (!curPoint) {
                    series[0].points[0].highlight();
                    return true;
                }

                newSeries = series[curPoint.series.index + (next ? 1 : -1)];
                newPoint = next ?
                    // Try to grab next point
                    curPoint.series.points[curPoint.index + 1] || newSeries && newSeries.points[0] :
                    // Try to grab previous point
                    curPoint.series.points[curPoint.index - 1] ||
                        newSeries && newSeries.points[newSeries.points.length - 1];

                // If there is no adjacent point, we return false
                if (newPoint === undefined) {
                    return false;
                }

                // Recursively skip null points
                if (newPoint.isNull && this.options.accessibility.keyboardNavigation &&
                        this.options.accessibility.keyboardNavigation.skipNullPoints) {
                    this.highlightedPoint = newPoint;
                    return this.highlightAdjacentPoint(next);
                }

                // There is an adjacent point, highlight it
                newPoint.highlight();
                return true;
            };

            H.addEvent(chart.renderTo, 'keydown', function (ev) {
                var e = ev || window.event,
                    keyCode = e.which || e.keyCode,
                    highlightedExportItem = chart.highlightedExportItem,
                    newSeries,
                    fakeEvent,
                    doExporting = chart.options.exporting && chart.options.exporting.enabled !== false,
                    exportList,
                    reachedEnd,
                    i;

                function highlightExportItem(i) {
                    if (exportList[i] && exportList[i].tagName === 'DIV' &&
                            !(exportList[i].children && exportList[i].children.length)) {
                        if (exportList[i].focus) {
                            exportList[i].focus();
                        }
                        exportList[highlightedExportItem].onmouseout();
                        exportList[i].onmouseover();
                        chart.highlightedExportItem = i;
                        return true;
                    }
                }

                function hideExporting() {
                    for (var a = 0; a < exportList.length; ++a) {
                        H.fireEvent(exportList[a], 'mouseleave');
                    }
                    exportList[highlightedExportItem].onmouseout();
                    chart.highlightedExportItem = 0;
                    chart.renderTo.focus();
                    chart.isExporting = false;
                }

                // Tab = right, Shift+Tab = left
                if (keyCode === 9) {
                    keyCode = e.shiftKey ? 37 : 39;
                }

                if (!chart.isExporting) {
                    switch (keyCode) {
                    case 37: // Left
                    case 39: // Right
                        if (!chart.highlightAdjacentPoint(keyCode === 39)) {
                            if (keyCode === 39 && doExporting) {
                                // Start export menu navigation
                                chart.highlightedPoint = null;
                                chart.isExporting = true;
                                chart.showExportMenu();
                            } else {
                                // Try to return as if user tabbed or shift+tabbed
                                // Some browsers won't allow mutation of event object, but try anyway
                                e.which = e.keyCode = 9;
                                return;
                            }
                        }
                        break;

                    case 38: // Up
                    case 40: // Down
                        if (chart.highlightedPoint) {
                            newSeries = series[chart.highlightedPoint.series.index + (keyCode === 38 ? -1 : 1)];
                            if (newSeries && newSeries.points[0]) {
                                newSeries.points[0].highlight();
                            } else if (keyCode === 40 && doExporting) {
                                // Start export menu navigation
                                chart.highlightedPoint = null;
                                chart.isExporting = true;
                                chart.showExportMenu();
                            }
                        }
                        break;

                    case 13: // Enter
                    case 32: // Spacebar
                        if (chart.highlightedPoint) {
                            chart.highlightedPoint.firePointEvent('click');
                        }
                        break;

                    default: return;
                    }
                } else {
                    // Keyboard nav for exporting menu
                    exportList = chart.exportDivElements;
                    switch (keyCode) {
                    case 37: // Left
                    case 38: // Up
                        i = highlightedExportItem = highlightedExportItem || 0;
                        reachedEnd = true;
                        while (i--) {
                            if (highlightExportItem(i)) {
                                reachedEnd = false;
                                break;
                            }
                        }
                        if (reachedEnd) {
                            hideExporting();
                            // Wrap to last point
                            if (series && series.length) {
                                newSeries = series[series.length - 1];
                                if (newSeries.points.length) {
                                    newSeries.points[newSeries.points.length - 1].highlight();
                                }
                            }
                        }
                        break;

                    case 39: // Right
                    case 40: // Down
                        highlightedExportItem = highlightedExportItem || 0;
                        reachedEnd = true;
                        for (var ix = highlightedExportItem + 1; ix < exportList.length; ++ix) {
                            if (highlightExportItem(ix)) {
                                reachedEnd = false;
                                break;
                            }
                        }
                        if (reachedEnd) {
                            hideExporting();
                            // Try to return as if user tabbed
                            // Some browsers won't allow mutation of event object, but try anyway
                            e.which = e.keyCode = 9;
                            e.shiftKey = false;
                            return;
                        }
                        break;

                    case 13: // Enter
                    case 32: // Spacebar
                        if (highlightedExportItem !== undefined) {
                            fakeEvent = document.createEvent('Events');
                            fakeEvent.initEvent('click', true, false);
                            exportList[highlightedExportItem].onclick(fakeEvent);
                        }
                        break;

                    default: return;
                    }
                }
                e.preventDefault();
            });
        });
    }(Highcharts));


    // Set up demo chart

    $('#container').highcharts({
        accessibility: {
            enabled: true,
            description: 'Most commonly used desktop screen readers from January 2009 to July 2015 as reported in the Webaim Survey.',
            keyboardNavigation: {
                skipNullPoints: true
            }
        },

        title: {
            text: 'Desktop screen readers from 2009 to 2015'
        },

        subtitle: {
            text: 'Click on point to visit official website'
        },

        xAxis: {
            title: {
                text: 'Time'
            },
            categories: ['January 2009', 'December 2010', 'May 2012', 'January 2014', 'July 2015']
        },

        plotOptions: {
            series: {
                events: {
                    click: function () {
                        window.location.href = this.options.website;
                    }
                },
                cursor: 'pointer'
            }
        },

        series: [
            {
                name: 'JAWS',
                data: [74, 69.6, 63.7, 63.9, 43.7],
                website: 'https://www.freedomscientific.com/Products/Blindness/JAWS'
            }, {
                name: 'NVDA',
                data: [8, 34.8, 43.0, 51.2, 41.4],
                website: 'https://www.nvaccess.org'
            }, {
                name: 'VoiceOver',
                data: [6, 20.2, 30.7, 36.8, 30.9],
                website: 'http://www.apple.com/accessibility/osx/voiceover'
            }, {
                name: 'Window-Eyes',
                data: [23, 19.0, 20.7, 13.9, 29.6],
                website: 'http://www.gwmicro.com/window-eyes'
            }, {
                name: 'ZoomText',
                data: [0, 6.1, 6.8, 5.3, 27.5],
                website: 'http://www.zoomtext.com/products/zoomtext-magnifierreader'
            }, {
                name: 'System Access To Go',
                data: [0, 16.2, 22.1, 26.2, 6.9],
                website: 'https://www.satogo.com'
            }, {
                name: 'ChromeVox',
                data: [0, 0, 2.8, 4.8, 2.8],
                website: 'http://www.chromevox.com'
            }, {
                name: 'Other',
                data: [0, 7.4, 5.9, 9.3, 6.5],
                website: 'http://www.disabled-world.com/assistivedevices/computer/screen-readers.php'
            }
        ]
    });
});
