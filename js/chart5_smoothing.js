/**
 * Chart 5 — Exploratory Trend Smoothing
 * Layered line chart with toggle for raw vs 5-year rolling average
 */

const smoothingMargin = { top: 60, right: 120, bottom: 70, left: 90 };
const smoothingWidth = 900 - smoothingMargin.left - smoothingMargin.right;
const smoothingHeight = 420 - smoothingMargin.top - smoothingMargin.bottom;

const smoothingSvg = d3
  .select("#chart5")
  .append("svg")
  .attr("width", smoothingWidth + smoothingMargin.left + smoothingMargin.right)
  .attr(
    "height",
    smoothingHeight + smoothingMargin.top + smoothingMargin.bottom,
  )
  .attr(
    "viewBox",
    `0 0 ${smoothingWidth + smoothingMargin.left + smoothingMargin.right} ${
      smoothingHeight + smoothingMargin.top + smoothingMargin.bottom
    }`,
  )
  .attr("preserveAspectRatio", "xMidYMid meet")
  .style("width", "100%")
  .style("height", "auto");

const smoothingG = smoothingSvg
  .append("g")
  .attr(
    "transform",
    `translate(${smoothingMargin.left},${smoothingMargin.top})`,
  );

const smoothingTooltip = d3.select("#tooltip");

const smoothingX = d3.scaleLinear().range([0, smoothingWidth]);
const smoothingY = d3.scaleLinear().range([smoothingHeight, 0]);

const smoothingXAxis = smoothingG
  .append("g")
  .attr("class", "axis")
  .attr("transform", `translate(0,${smoothingHeight})`);

const smoothingYAxis = smoothingG.append("g").attr("class", "axis");

smoothingSvg
  .append("text")
  .attr("class", "axis-label")
  .attr("x", smoothingMargin.left + smoothingWidth / 2)
  .attr("y", smoothingHeight + smoothingMargin.top + 40)
  .attr("text-anchor", "middle")
  .text("Year");

smoothingSvg
  .append("text")
  .attr("class", "axis-label")
  .attr("transform", "rotate(-90)")
  .attr("x", -(smoothingMargin.top + smoothingHeight / 2))
  .attr("y", 20)
  .attr("text-anchor", "middle")
  .text("Life Expectancy (years)");

const rawLine = d3
  .line()
  .x((d) => smoothingX(d.year))
  .y((d) => smoothingY(d.life_expectancy));

const avgLine = d3
  .line()
  .x((d) => smoothingX(d.year))
  .y((d) => smoothingY(d.life_expectancy_5yr_avg));

let smoothingData = [];

d3.csv("dataset/life_expectancy_advanced.csv").then((raw) => {
  const parsed = raw.map((d) => ({
    year: +d.year,
    life_expectancy: +d.life_expectancy,
    life_expectancy_5yr_avg: +d.life_expectancy_5yr_avg,
    interpolated: d.life_expectancy_was_interpolated === "True",
  }));

  const grouped = d3.rollups(
    parsed,
    (values) => {
      const validLife = values.filter((d) =>
        Number.isFinite(d.life_expectancy),
      );
      const validAvg = values.filter((d) =>
        Number.isFinite(d.life_expectancy_5yr_avg),
      );

      return {
        life_expectancy: d3.mean(validLife, (d) => d.life_expectancy),
        life_expectancy_5yr_avg: d3.mean(
          validAvg,
          (d) => d.life_expectancy_5yr_avg,
        ),
        interpolated_share: d3.mean(values, (d) => (d.interpolated ? 1 : 0)),
      };
    },
    (d) => d.year,
  );

  smoothingData = grouped
    .map(([year, stats]) => ({
      year,
      life_expectancy: stats.life_expectancy,
      life_expectancy_5yr_avg: stats.life_expectancy_5yr_avg,
      interpolated_share: stats.interpolated_share || 0,
    }))
    .filter((d) => Number.isFinite(d.life_expectancy))
    .sort((a, b) => a.year - b.year);

  drawSmoothingChart();
});

function drawSmoothingChart() {
  if (smoothingData.length === 0) return;

  smoothingX.domain(d3.extent(smoothingData, (d) => d.year));
  smoothingY
    .domain([
      d3.min(smoothingData, (d) => d.life_expectancy) - 2,
      d3.max(smoothingData, (d) => d.life_expectancy) + 2,
    ])
    .nice();

  smoothingXAxis.call(
    d3.axisBottom(smoothingX).ticks(6).tickFormat(d3.format("d")),
  );
  smoothingYAxis.call(d3.axisLeft(smoothingY).ticks(6));

  smoothingG.selectAll(".smoothing-raw").remove();
  smoothingG.selectAll(".smoothing-avg").remove();
  smoothingG.selectAll(".smoothing-dot").remove();

  const showRaw = d3.select("#toggle-raw").property("checked");
  const showAvg = d3.select("#toggle-avg").property("checked");

  if (showRaw) {
    smoothingG
      .append("path")
      .datum(smoothingData)
      .attr("class", "smoothing-raw")
      .attr("fill", "none")
      .attr("stroke", "#0f172a")
      .attr("stroke-width", 1.5)
      .attr("opacity", 0.6)
      .attr("d", rawLine);
  }

  if (showAvg) {
    smoothingG
      .append("path")
      .datum(smoothingData)
      .attr("class", "smoothing-avg")
      .attr("fill", "none")
      .attr("stroke", "#2563eb")
      .attr("stroke-width", 2.5)
      .attr("d", avgLine);
  }

  smoothingG
    .selectAll(".smoothing-dot")
    .data(smoothingData)
    .enter()
    .append("circle")
    .attr("class", "smoothing-dot")
    .attr("cx", (d) => smoothingX(d.year))
    .attr("cy", (d) => smoothingY(d.life_expectancy))
    .attr("r", 3)
    .attr("fill", "#0f172a")
    .attr("opacity", (d) => (d.interpolated_share > 0 ? 0.4 : 0.8))
    .on("mouseover", (event, d) => {
      const interpolatedLabel = d.interpolated_share > 0 ? "Yes" : "No";
      smoothingTooltip
        .style("opacity", 1)
        .html(
          `Year: ${d.year}<br/>Raw: ${d.life_expectancy.toFixed(1)}<br/>Avg: ${
            d.life_expectancy_5yr_avg
              ? d.life_expectancy_5yr_avg.toFixed(1)
              : "N/A"
          }<br/>Interpolated: ${interpolatedLabel}`,
        );
    })
    .on("mousemove", (event) => {
      smoothingTooltip
        .style("left", event.pageX + 12 + "px")
        .style("top", event.pageY + 12 + "px");
    })
    .on("mouseout", () => smoothingTooltip.style("opacity", 0));
}

d3.selectAll("#toggle-raw, #toggle-avg").on("change", drawSmoothingChart);
