window.selectedCountryCode = null;
let latestMapRenderToken = 0;

const width = 500;
const height = 220;

const svg = d3
  .select("#map")
  .attr("width", width)
  .attr("height", height)
  .attr("viewBox", `0 0 ${width} ${height}`)
  .attr("preserveAspectRatio", "xMidYMid meet")
  .style("width", "100%")
  .style("height", "auto");

const mapGroup = svg.append("g").attr("class", "map-group");

const zoom = d3
  .zoom()
  .filter((event) => event.type !== "wheel")
  .scaleExtent([1, 6])
  .on("zoom", (event) => {
    mapGroup.attr("transform", event.transform);
  });

svg.call(zoom);

d3.select("#map-zoom-in").on("click", () => {
  svg.transition().duration(250).call(zoom.scaleBy, 1.25);
});

d3.select("#map-zoom-out").on("click", () => {
  svg.transition().duration(250).call(zoom.scaleBy, 0.8);
});

const tooltip = d3.select("#tooltip");

const sidePanel = d3.select("#side-panel");
const panelCountry = d3.select("#panel-country");
const panelYear = d3.select("#panel-year");
const panelLife = d3.select("#panel-life");
const panelIncome = d3.select("#panel-income");
const panelRegion = d3.select("#panel-region");

// Projection
const projection = d3
  .geoNaturalEarth1()
  .scale(85)
  .translate([width / 2, height / 2 + 8]);

const path = d3.geoPath().projection(projection);

// Color scale (sequential, examiner-safe)
const colorScale = d3
  .scaleSequential()
  .interpolator((t) => d3.interpolateGreens(t * 0.85 + 0.05));

// Load data once
let csvData = null;
let geoData = null;

Promise.all([
  d3.csv("dataset/life_expectancy_clean.csv"),
  d3.json("dataset/world.geojson"),
]).then(([loadedCsvData, loadedGeoData]) => {
  csvData = loadedCsvData;
  geoData = loadedGeoData;
  
  // Initialize map with countries
  const mapLayer = mapGroup.append("g").attr("class", "map-layer");
  
  mapLayer
    .selectAll("path")
    .data(geoData.features)
    .join("path")
    .attr("d", path)
    .attr("stroke", "#999")
    .attr("stroke-width", 0.4)
    .attr("class", "country")
    .attr("fill", "#eee")
    .on("mouseover", handleMouseOver)
    .on("mousemove", handleMouseMove)
    .on("mouseout", handleMouseOut)
    .on("click", handleClick);
    
  drawLifeExpectancyMap(null);
});

// Main draw function
function getActiveGroups() {
  return window.activeIncomeGroups || null;
}

function getDashboardFilters() {
  return (
    window.dashboardFilters || {
      regions: new Set(),
      lifeRange: { min: null, max: null },
      co2Range: { min: null, max: null },
    }
  );
}

// Interaction handlers - Keep data map in closure for quick access
let currentDataMap = new Map();
let currentIsAllYears = true;

function handleMouseOver(event, d) {
  const row = currentDataMap.get(d.properties.SOV_A3);

  tooltip.style("opacity", 1).html(
    row
      ? `
        <strong>${row.country}</strong><br/>
        ${currentIsAllYears ? "Avg Life Expectancy" : "Life Expectancy"}: ${
          row.life_expectancy
        }<br/>
        Income Group: ${row.income_group}<br/>
        Region: ${row.region}
      `
      : `
        <strong>${d.properties.ADMIN}</strong><br/>
        No data
      `,
  );
}

function handleMouseMove(event) {
  tooltip
    .style("left", event.pageX + 12 + "px")
    .style("top", event.pageY + 12 + "px");
}

function handleMouseOut() {
  tooltip.style("opacity", 0);
}

function handleClick(event, d) {
  const row = currentDataMap.get(d.properties.SOV_A3);
  
  if (!row) return;

  window.selectedCountryCode = d.properties.SOV_A3;

  mapGroup.selectAll("path")
    .classed("selected", (p) => p.properties.SOV_A3 === window.selectedCountryCode);

  // Update side panel
  panelCountry.text(row.country);
  panelYear.text(currentIsAllYears ? "All Years" : getYearFilter());
  panelLife.text(
    Number.isFinite(row.life_expectancy)
      ? row.life_expectancy.toFixed(1)
      : "N/A",
  );
  panelIncome.text(row.income_group);
  panelRegion.text(row.region);

  sidePanel.classed("hidden", false);
}

// Update the data map when redrawing
function drawLifeExpectancyMap(selectedYear) {
  const renderToken = ++latestMapRenderToken;
  
  if (!csvData || !geoData) return;

  selectedCountryCode = null;
  sidePanel.classed("hidden", true);

  const activeGroups = getActiveGroups();
  const filters = getDashboardFilters();
  currentIsAllYears = !Number.isFinite(selectedYear);
  const filtered = csvData
    .filter((d) => (activeGroups ? activeGroups.has(d.income_group) : true))
    .filter((d) =>
      filters?.regions?.size ? filters.regions.has(d.region) : true,
    );

  const yearData = currentIsAllYears
    ? d3
        .rollups(
          filtered,
          (values) => ({
            country: values[0].country,
            country_code: values[0].country_code,
            income_group: values[0].income_group,
            region: values[0].region,
            life_expectancy: d3.mean(values, (v) => +v.life_expectancy),
          }),
          (d) => d.country_code,
        )
        .map(([, value]) => value)
    : filtered
        .filter((d) => +d.year === selectedYear)
        .map((d) => ({ ...d, life_expectancy: +d.life_expectancy }));

  const lifeRange = filters.lifeRange || { min: null, max: null };
  const filteredByLife = yearData.filter((d) => {
    if (!Number.isFinite(d.life_expectancy)) return false;
    if (lifeRange.min != null && d.life_expectancy < lifeRange.min)
      return false;
    if (lifeRange.max != null && d.life_expectancy > lifeRange.max)
      return false;
    return true;
  });

  // Update the current data map for interactions
  currentDataMap = new Map(filteredByLife.map((d) => [d.country_code, d]));

  const lifeExtent = d3.extent(filteredByLife, (d) => d.life_expectancy);
  colorScale.domain(lifeExtent[0] == null ? [0, 1] : lifeExtent);

  // Update colors with transition (no clearing)
  mapGroup.selectAll(".country")
    .transition()
    .duration(500)
    .attr("fill", (d) => {
      const row = currentDataMap.get(d.properties.SOV_A3);
      return row ? colorScale(row.life_expectancy) : "#eee";
    });

  // Update tooltip if mouse is currently hovering over a country
  const hoveredCountry = document.querySelector('.country:hover');
  if (hoveredCountry) {
    // Find the corresponding geo feature
    const geoFeatures = mapGroup.selectAll('.country').data();
    const countryData = geoFeatures.find(f => {
      return hoveredCountry.getAttribute('d') === path(f);
    });
    
    if (countryData) {
      handleMouseOver(null, countryData);
    }
  }

  // Update legend
  svg.selectAll("g.legend").remove();
  svg.selectAll("defs").remove();
  drawLegend();
}

// Legend function
function drawLegend() {
  const legendWidth = 180;
  const legendHeight = 8;

  const legendX = 14;
  const legendY = height - 42;

  const legendGroup = svg
    .append("g")
    .attr("class", "legend")
    .attr("transform", `translate(${legendX}, ${legendY})`);

  legendGroup
    .append("text")
    .attr("x", 0)
    .attr("y", -4)
    .attr("font-size", "10px")
    .attr("font-weight", "bold")
    .text("Life Expectancy (years)");

  const legendScale = d3
    .scaleLinear()
    .domain(colorScale.domain())
    .range([0, legendWidth]);

  const legendAxis = d3
    .axisBottom(legendScale)
    .ticks(3)
    .tickFormat((d) => d + " yrs");

  const gradient = svg
    .append("defs")
    .append("linearGradient")
    .attr("id", "legend-gradient");

  gradient
    .selectAll("stop")
    .data(d3.range(0, 1.01, 0.1))
    .join("stop")
    .attr("offset", (d) => d)
    .attr("stop-color", (d) =>
      colorScale(
        colorScale.domain()[0] +
          d * (colorScale.domain()[1] - colorScale.domain()[0]),
      ),
    );

  legendGroup
    .append("rect")
    .attr("width", legendWidth)
    .attr("height", legendHeight)
    .style("fill", "url(#legend-gradient)");

  legendGroup
    .append("g")
    .attr("transform", `translate(0,${legendHeight})`)
    .call(legendAxis)
    .call((g) => g.selectAll("text").attr("font-size", "8px"));

  legendGroup
    .append("text")
    .attr("x", 0)
    .attr("y", legendHeight + 30)
    .attr("font-size", "9px")
    .attr("fill", "#555")
    .text("Grey = No data");
}
