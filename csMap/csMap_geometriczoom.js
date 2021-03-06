// create D3 visualization viewport parameters
var margin = {
    top: 50,
    right: 80,
    bottom: 30,
    left: 50
}
// size of full vis
var width = 960 - margin.left - margin.right
var height = 600 - margin.bottom - margin.top

// zoomable area
var zoomVis = {
    coordinates:[134, 40] ,
    w: 130,
    h: 100
}
var active = d3.select(null)

// use this for histogram vis beneath slider
var bbVis = {
    x: margin.left, 
    y: height + margin.top - 210,
    w: width,
    h: 210,
}

// attach svg object to the DOM
var svg_map = d3.select("#fishmap").append("svg")
    .attr({
        width: width + margin.left + margin.right,
        height: height + margin.top + margin.bottom
    })

// give the SVG a background color
svg_map.append("rect")
   .attr({
    class: "map_background",
    width: "100%",
    height: "100%",
    fill: "aliceblue",
   })
   .on("click", reset)

var g = svg_map.append("g").attr({
        transform: "translate(" + margin.left + "," + margin.top + ")"
    })

// a variety of map projection methods
var projectionMethods = [
    { // 0 -- overview -- use this and translate eq of 2
        name: "aziumuthal equal area Pacific",
        method: d3.geo.azimuthalEqualArea().translate([(width / 2) - 40, (height / 2) +160]).rotate([-180, 0]).scale(480).precision(.01)
    },{ // 1 -- overview -- looks more "normal"
        name: "equirectangular Pacific",
        method: d3.geo.equirectangular().translate([(width / 2) - 100, (height / 2) + 150]).rotate([-160, 0]).scale(400).precision(.01)
    },{ // 2 -- zoomed -- this looks better
        name: "aziumuthal equal area Pacific",
        method: d3.geo.azimuthalEqualArea().translate([(width / 2) , (height / 2) ]).rotate([-144, -34]).scale(2000).precision(.01)
    },{ // 3 -- zoomed
        name: "equirectangular Pacific",
        method: d3.geo.equirectangular().translate([(width / 2), (height / 2)]).rotate([-140, -34]).scale(1800).precision(.01)
    }

]

// base map parameters
var actualProjectionMethod = 0
var projection =  projectionMethods[actualProjectionMethod].method
var path_map = d3.geo.path().projection(projection)
var rScale = d3.scale.log().range([1, 15])

// slider & bar chart params
var parseDate = d3.time.format("%m/%e/%y").parse
var formatDate = d3.time.format("%b %Y")
var slider_x = d3.time.scale().range([0, width]).clamp(true)

// circle transparency scales
var fillOpScale = d3.scale.linear().range([0, 0.7])
var strokeOpScale = d3.scale.linear().range([0, 1])
var one_day = 1000*60*60*24   // one day in milliseconds
fillOpScale.domain([30*one_day, 0])
strokeOpScale.domain([90*one_day, 0])

// scatterplot chart parameters
var chartXScale = d3.scale.linear().range([bbVis.x, bbVis.x + bbVis.w])
var chartYScale = d3.scale.log().range([bbVis.y + bbVis.h, bbVis.y])
var chartXAxis = d3.svg.axis().scale(chartXScale).orient("bottom").ticks(30)
var chartYAxis = d3.svg.axis().scale(chartYScale).orient("right").ticks(10)

// tooltips
//--from http://bl.ocks.org/Caged/6476579 ----------------//
var tip = d3.tip()
  .attr('class', 'd3-tip')
  .offset([-10, 0])
  .html(function(d) {
    return "<strong>Cs137:</strong> " + d.cs137 +"<br><strong>Cs134:</strong> " + d.cs134 +"<br><strong>Salinity:</strong> " + d.salinity + "<br><strong>Temp: </strong>" + d.temp
  })
  svg_map.call(tip)
//------------------------------------------------------//

// load map data and display
// original data from naturalearthdata.com
var worldCoasts, worldCities, worldCountries

queue().defer(d3.json, "../data/ne_50m_coastline.json")
       .defer(d3.json, "../data/ne_50m_populated_places.json")
       .defer(d3.json, "../data/ne_50m_admin_0_countries.json")
       .await(loadMap)

function loadMap(error, coastline_data, cities_data, country_data){
    worldCoasts = topojson.feature(coastline_data,coastline_data.objects.ne_50m_coastline).features
    worldCities = topojson.feature(cities_data, cities_data.objects.ne_50m_populated_places).features
    worldCountries = topojson.feature(country_data, country_data.objects.ne_50m_admin_0_countries).features
    displayMap()
}

function displayMap(){
    // land area
    svg_map.append("svg:defs")
        .append("svg:pattern")
        .attr({
            id: "mountaintile",
            patternUnits: "userSpaceOnUse",
            width: 575,
            height: 575,
        })
        .append("svg:image")
        .attr({
            width: 575,
            height: 575,
            "xlink:href": "../images/mountaintile.jpg",
        })
    var coastline = g.append("g")
        .attr("id", "coastline")
        .selectAll("path")
        .data(worldCoasts)
        .enter()
        .append("path")
        .attr({
            d: path_map,
        })
        .style({
            stroke: "none", 
            fill: "url(#mountaintile)",
            "fill-opacity": 0.6,
        })
        .on("click", clicked)
    // country administrative borders
    var countries = g.append("g")
        .attr("id", "countries")
        .selectAll("path")
        .data(worldCountries)
        .enter()
        .append("path")
        .attr({
            d: path_map,
        })
        .style({
            stroke: "lightgrey",
            "stroke-opacity": 0.3,
            fill: "none",
        })
        
    // city markers
    var cities = g.append("g")
        .attr("id", "cities")
        .selectAll("circle")
        .data(worldCities)
        .enter()
        .append("circle")
        .filter(function(d){
            return d.properties.SCALERANK <=1
        })
        .attr({
            transform: function(d){
                return "translate(" + projection(d.geometry.coordinates) + ")"
            },
            r: 3,
        })
        .style({
            stroke: "black",
            "stroke-width": 0,
            fill: "#1A1A1E",
            "fill-opacity": 0.7,
            r: 1,
        })

    // city names
    var city_labels = g.append("g")
        .attr("id", "city_labels")
        .selectAll("text")
        .data(worldCities)
        .enter()
        .append("text")
        .filter(function(d){
            return d.properties.SCALERANK <=1
        })
        .text(function(d){
            return d.properties.NAME
        })
        .attr({
            transform: function(d){
                return "translate(" + projection(d.geometry.coordinates) + ")"
            },
            dx: -2,
            dy: -2,
            r: 3,
        })
        .style({
            stroke: "black",
            "stroke-width": 0,
            fill: "#1A1A1E",
            "fill-opacity": 0.5,
            "text-anchor": "end",
        })

    // bounding box for zoomable area around Japan
    var zoom_box = g.append("g")
        .attr("id", "zoom_box")
        .append("rect")
        .attr({
            x: projection(zoomVis.coordinates)[0],
            y: projection(zoomVis.coordinates)[1],
            width: zoomVis.w,
            height: zoomVis.h,
            d: path_map,
        })
        .style({
            fill: "ghostwhite",
            "fill-opacity": 0.3,
            stroke: "#1A1A1E",
            "stroke-opacity": 0.75,
            visibility: function(){ if(active.node() === this){ return "hidden"} else {return "visible"}},
        })
        .on("click", clicked)
    var zoom_label = g.append("g").append("text")
        .attr({
            x: projection(zoomVis.coordinates)[0],
            y: projection(zoomVis.coordinates)[1] + zoomVis.h,
            dx: 2,
            dy: 11,
        })
        .style({
            "text-anchor": "start",
            fill: "#1A1A1E",
            "fill-opacity":0.6,
        })
        .text("click to zoom")

    loadData()
}

// zooming functions adapted from http://bl.ocks.org/mbostock/4699541 ------//
// zoom to bounded area
function clicked(d){
    if(active.node() === this) { return reset() }
    active.classed("active", false)
    active = d3.select(this).classed("active", true)
    g.transition()
        .duration(750)
        .attr({
            transform: "translate(80, -150) scale(2.8)",
        })
}

function reset(){
    active.classed("active", false)
    active = d3.select(null)
    g.transition()
        .duration(750)
        .attr({
            transform: "",
        })
}
//--------------------------------------------------------------------------//


// cesium data loaded into an array
var csData = []
var fukushimaLongLat = [141.0329, 37.4230]
var fukushimaCoord = projection(fukushimaLongLat)

function loadData(){
    d3.json("../data/allCsData.json", function(error, data){
        // this is super janky - need to find a better solution than all these parseFloats..
        data.forEach(function(d){
            // console.log("cs137: ", parseFloat(d['cs137'].replace(/,/g,'')))
            csData.push({
                source: d['source'],
                coordinates: projection([d.coordinates[0], d.coordinates[1]]),
                cs134: parseFloat(d['cs134'].replace(/,/g,'')),
                cs137: parseFloat(d['cs137'].replace(/,/g,'')),
                date: parseDate(d['date']),
                temp: d['temp'],
                salinity: d['salinity'],
                depth: d['depth'],
                fukushimaDistance: calcDist([d.coordinates[0], d.coordinates[1]]),
            })
        })
        // calculate max and min values for scales
        var cs137Min = 1
        var cs137Max = 0
        var fDistMin = 1 
        var fDistMax = 0
        csData.map(function(d){
            if(parseFloat(d.cs137) < cs137Min){
                cs137Min = parseFloat(d.cs137)
            }
            if(parseFloat(d.cs137) > cs137Max){
                cs137Max = parseFloat(d.cs137)
            }
            if(parseFloat(d.fukushimaDistance) < fDistMin){
                fDistMin = parseFloat(d.fukushimaDistance)
            }
            if(parseFloat(d.fukushimaDistance) > fDistMax){
                fDistMax = parseFloat(d.fukushimaDistance)
            }
        })
        // update circle radius scale
        rScale.domain([cs137Min, cs137Max])
        // update slider scale
        slider_x.domain(d3.extent(csData, function(d){ return d.date }))
        // update chart scales
        chartXScale.domain([fDistMin, fDistMax]).clamp(true).nice()
        chartYScale.domain([cs137Min, cs137Max]).clamp(true).nice()
        // once everything's loaded...display data on map
        drawCircles(csData)
        drawFukushima()
        drawSlider()
        drawChart(csData)
    })
}

function drawCircles(data){
    var readings = g.append("g")
        .attr("id", "readings")
        .selectAll("circle")
        .data(data)
        .enter()
        .append("circle")
        .filter(function(d){ return d.cs137 > 0 })
        .attr("class", "reading")
        .attr({
            transform: function(d){
                return "translate(" + d.coordinates + ")"
            },
            r: function(d){ return rScale(d.cs137) },
        })
        .style({
            fill: "darkblue",
            stroke: "darkblue",
            "stroke-opacity": 0.1, 
        })
        .on("mouseover", tip.show)
        .on("mouseout", tip.hide)

}

function drawFukushima(){
    var fukushima = g.append("g")
        .attr("id", "fukushima")
        .append("circle")
        .attr({
            transform: "translate(" + fukushimaCoord + ")",
            r: "3",
        })
        .style({
            fill: "orange",
            stroke: "darkred",
            "stroke-width": "2",
        })
    //-- concentric circles emanating from a point from: http://bl.ocks.org/mbostock/4503672
    setInterval(function(){
        g.append("circle")
           .attr({
            class: "ring",
            transform: "translate(" + fukushimaCoord + ")",
            r: "10",
           })
           .style({
            "stroke-width": 3,
            stroke: "darkred",
           })
           .transition()
           .ease("linear")
           .duration(2000)
           .style({
            fill: "none",
            "stroke-opacity": "1e-6",
            "stroke-width": 1,
            stroke: "brown"
           })
           .attr("r", 50)
           .remove()
       }, 1200)
    //---------------------------------------------------------------------//
}

//-- borrowed from http://bl.ocks.org/mbostock/6452972 ---//
function drawSlider(){    
    var brush = d3.svg.brush().x(slider_x).extent([0,0]).on("brush", brushed)

    svg_map.append("g")
           .attr({
            class: "x axis",
            transform: "translate(" + margin.left + "," + (bbVis.y - 30) + ")",
           })
           .call(d3.svg.axis()
              .scale(slider_x)
              .orient("bottom")
              .tickFormat(function(d){ return formatDate(d) })
              .tickSize(0)
              .tickPadding(12))
           .select(".domain")
           .select(function(){ return this.parentNode.appendChild(this.cloneNode(true)) })
           .attr("class", "halo")

    var slider = svg_map.append("g")
        .attr("class", "slider")
        .call(brush)

    slider.selectAll(".background")
          .attr({
            transform: "translate(" + margin.left + "," + (bbVis.y - 30 -10) + ")",
            height: 30,
         })

    var handle = slider.append("circle")
        .attr({
            class: "handle",
            transform: "translate(" + margin.left + "," + (bbVis.y - 30) + ")",
            r: 9,
        })

    slider.call(brush.event)
          .transition()
          .duration(750)
          .call(brush.extent([0, 0]))
          .call(brush.event)

    function brushed(){
        var value = brush.extent()[0]

        if(d3.event.sourceEvent){
            value = slider_x.invert(d3.mouse(this)[0])
            brush.extent([value, value])
        }

        handle.attr("cx", slider_x(value))
        // change opacity of map circles
        d3.selectAll(".reading").attr({
            "fill-opacity": function(d){ return fillOpScale(Math.abs(value - d.date)) },
            "stroke-opacity": function(d){ return strokeOpScale(Math.abs(value - d.date)) },
        })
        // change opacity of chart dots
        d3.selectAll(".dot").attr({
            "fill-opacity": function(d){ return fillOpScale(Math.abs(value - d.date)) },
            "stroke-opacity": function(d){ return strokeOpScale(Math.abs(value - d.date)) },
        })
    }
}
//---------------------------------------------------------------------//

// create a scatterplot of the cs measurements over distance from Fukushima
function drawChart(data){
    var chart = svg_map.append("g")
                .attr("id", "chart_background")
                .append("rect")
                .attr({
                    transform: "translate(" + bbVis.x + ", " + bbVis.y + ")",
                    width: bbVis.w,
                    height: bbVis.h,
                })
                .style({
                    fill: "ghostwhite",
                    stroke: "darkolivegreen"                    
                })

    var dots = svg_map.append("g")
        .attr("id", "dots")
        .selectAll(".dot")
        .data(data)
        .enter()
        .append("circle")
        .filter(
            function(d){ if(isNaN(d.cs137)){ return false } else {  return true } }
        )
        .attr("class", "dot")
        .attr({
            r: 3,
            cx: function(d){ return chartXScale(d.fukushimaDistance) },
            cy: function(d){ if(d.cs137 > 0){ return chartYScale(d.cs137)} },
        })
        .style({
            fill: "darkblue",
            stroke: "darkblue",
            "stroke-width": 1,
            "stroke-opacity": 0.1,

        })
        .on("mouseover", tip.show)
        .on("mouseout", tip.hide)
    // X Axis
    svg_map.append("g")
        .attr({
           class: "chart_axis",
           transform: "translate(" + 0 + ", " + (bbVis.y + 210)  + ")",
        })
        .call(chartXAxis)
        .selectAll("text:not(.x_title")
        .style({
           "font-size": "8pt",
        })
    // X Axis Title
    svg_map.append("text")
        .attr({
            class: "chart_title",
            x: bbVis.x + bbVis.w,
            y: bbVis.y + bbVis.h,
            dx: "-0.4em",
            dy: "-0.4em",
        })
        .style("text-anchor", "end")
        .text("Distance from Fukushima (km)")
    // Y Axis
    svg_map.append("g")
        .attr({
            class: "chart_axis",
            transform: "translate(" + (bbVis.x + bbVis.w )+ ",0)",
        })
        .call(chartYAxis)
    // Y Axis Title
    svg_map.append("text")
        .attr({
            class: "chart_title",
            transform: "rotate(-90)",
            x: -(bbVis.y),
            y: bbVis.x + bbVis.w,
            // x: bbVis.y + bbVis.h,
            // y: bbVis.x + bbVis.w,            
            dx: "-0.5em",
            dy: "-0.5em",
        })
        .style("text-anchor", "end")
        .text("Cs137 (Bq/m^3)")
}

// calculate distance between two sets of map coordinates
//-- adapted from https://groups.google.com/forum/#!topic/d3-js/0p7LuNHpEbM---//
function calcDist (cC) {
    // origin point: fukushimaLongLat
    var dLatRad = Math.abs(fukushimaLongLat[1] - cC[1]) * Math.PI/180
    var dLonRad = Math.abs(fukushimaLongLat[0] - cC[0]) * Math.PI/180
    // Calculate origin in Radians
    var lat1Rad = fukushimaLongLat[1] * Math.PI/180
    var lon1Rad = fukushimaLongLat[0] * Math.PI/180
    // Calculate new point in Radians
    var lat2Rad = cC[1] * Math.PI/180
    var lon2Rad = cC[0] * Math.PI/180

    // Earth's Radius
    var eR = 6371

    var d1 = Math.sin(dLatRad/2) * Math.sin(dLatRad/2) +
     Math.sin(dLonRad/2) * Math.sin(dLonRad/2) * Math.cos(lat1Rad) * Math.cos(lat2Rad)
    var d2 = 2 * Math.atan2(Math.sqrt(d1), Math.sqrt(1-d1))

    return(eR * d2) // distance in km
}
//---------------------------------------------------------------------//
