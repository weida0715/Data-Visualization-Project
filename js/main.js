const slider = d3.select("#year-slider");
const yearLabel = d3.select("#year-label");
const playBtn = d3.select("#play-btn");
const yearTicks = d3.select("#year-ticks");
const regionFilters = d3.select("#region-filters");
const lifeMinInput = d3.select("#life-min");
const lifeMaxInput = d3.select("#life-max");
const lifeMinLabel = d3.select("#life-min-label");
const lifeMaxLabel = d3.select("#life-max-label");
const co2MinInput = d3.select("#co2-min");
const co2MaxInput = d3.select("#co2-max");
const co2MinLabel = d3.select("#co2-min-label");
const co2MaxLabel = d3.select("#co2-max-label");
const resetBtn = d3.select("#reset-filters");

const START_YEAR = 2001;
const END_YEAR = 2019;
const ALL_YEARS_VALUE = START_YEAR - 1;
const ALL_YEARS_LABEL = "All Year";

let years = [ALL_YEARS_VALUE, ...d3.range(START_YEAR, END_YEAR + 1)];
let playInterval = null;
let isPlaying = false;
let isYearFiltered = true;

const dashboardFilters = {
  regions: new Set(),
  lifeRange: { min: null, max: null },
  co2Range: { min: null, max: null },
};

window.dashboardFilters = dashboardFilters;

const lifeFormatter = d3.format(".1f");
const co2Formatter = d3.format(",.0f");

function updateActiveIncomeGroups() {
  const active = new Set(
    Array.from(document.querySelectorAll(".income-checkbox"))
      .filter((cb) => cb.checked)
      .map((cb) => cb.value),
  );
  window.activeIncomeGroups = active;
  return active;
}

function updateActiveRegions() {
  const selected = new Set(
    Array.from(document.querySelectorAll(".region-checkbox"))
      .filter((cb) => cb.checked)
      .map((cb) => cb.value),
  );

  if (selected.size === 0) {
    document.querySelectorAll(".region-checkbox").forEach((cb) => {
      cb.checked = true;
      selected.add(cb.value);
    });
  }

  dashboardFilters.regions = selected;
  return selected;
}

function updateRangeLabels() {
  if (dashboardFilters.lifeRange.min != null) {
    lifeMinLabel.text(lifeFormatter(dashboardFilters.lifeRange.min));
    lifeMaxLabel.text(lifeFormatter(dashboardFilters.lifeRange.max));
  }
  if (dashboardFilters.co2Range.min != null) {
    co2MinLabel.text(co2Formatter(dashboardFilters.co2Range.min));
    co2MaxLabel.text(co2Formatter(dashboardFilters.co2Range.max));
  }
}

function syncLifeRange(source) {
  let minValue = +lifeMinInput.property("value");
  let maxValue = +lifeMaxInput.property("value");

  if (minValue > maxValue) {
    if (source === "min") {
      maxValue = minValue;
      lifeMaxInput.property("value", maxValue);
    } else {
      minValue = maxValue;
      lifeMinInput.property("value", minValue);
    }
  }

  dashboardFilters.lifeRange = { min: minValue, max: maxValue };
  updateRangeLabels();
}

function syncCo2Range(source) {
  let minValue = +co2MinInput.property("value");
  let maxValue = +co2MaxInput.property("value");

  if (minValue > maxValue) {
    if (source === "min") {
      maxValue = minValue;
      co2MaxInput.property("value", maxValue);
    } else {
      minValue = maxValue;
      co2MinInput.property("value", minValue);
    }
  }

  dashboardFilters.co2Range = { min: minValue, max: maxValue };
  updateRangeLabels();
}

function redrawDashboard(year) {
  const filterYear = year === ALL_YEARS_VALUE ? null : year;
  drawLifeExpectancyMap(filterYear);
  drawScatter(filterYear);
  drawTrendChart(filterYear);
  if (typeof drawRegionChart === "function") {
    drawRegionChart();
  }
  if (typeof drawSmoothingChart === "function") {
    drawSmoothingChart(filterYear);
  }
  if (typeof drawMissingChart === "function") {
    drawMissingChart(filterYear);
  }
  updateChartInsights(filterYear);
}

function renderYearTicks() {
  if (yearTicks.empty()) return;

  const tickYears = [ALL_YEARS_VALUE, ...d3.range(START_YEAR, END_YEAR + 1)];

  yearTicks
    .selectAll("span")
    .data(tickYears)
    .join("span")
    .text((year) => (year === ALL_YEARS_VALUE ? ALL_YEARS_LABEL : year));
}

function getYearFilter() {
  return +slider.property("value");
}

// Load data
d3.csv("dataset/life_expectancy_clean.csv").then(() => {
  d3.csv("dataset/life_expectancy_clean.csv").then((raw) => {
    const parsed = raw.map((d) => ({
      region: d.region,
      life_expectancy: +d.life_expectancy,
      co2: d.co2 === "" ? null : +d.co2,
    }));

    const regions = Array.from(
      new Set(parsed.map((d) => d.region).filter(Boolean)),
    ).sort();

    const lifeExtent = d3.extent(parsed, (d) => d.life_expectancy);
    const co2Extent = d3.extent(
      parsed.filter((d) => Number.isFinite(d.co2) && d.co2 > 0),
      (d) => d.co2,
    );

    regionFilters.selectAll("label").remove();
    const regionLabels = regionFilters
      .selectAll("label")
      .data(regions)
      .join("label");

    regionLabels.each(function (region) {
      const label = d3.select(this);
      label.selectAll("*").remove();
      label
        .append("input")
        .attr("type", "checkbox")
        .attr("class", "region-checkbox")
        .attr("value", region)
        .property("checked", true);
      label.append("span").text(region);
    });

    dashboardFilters.regions = new Set(regions);
    dashboardFilters.lifeRange = {
      min: lifeExtent[0],
      max: lifeExtent[1],
    };
    dashboardFilters.co2Range = {
      min: co2Extent[0],
      max: co2Extent[1],
    };

    lifeMinInput
      .attr("min", lifeExtent[0])
      .attr("max", lifeExtent[1])
      .attr("step", 0.1)
      .property("value", lifeExtent[0]);
    lifeMaxInput
      .attr("min", lifeExtent[0])
      .attr("max", lifeExtent[1])
      .attr("step", 0.1)
      .property("value", lifeExtent[1]);

    co2MinInput
      .attr("min", co2Extent[0])
      .attr("max", co2Extent[1])
      .attr("step", 1000)
      .property("value", co2Extent[0]);
    co2MaxInput
      .attr("min", co2Extent[0])
      .attr("max", co2Extent[1])
      .attr("step", 1000)
      .property("value", co2Extent[1]);

    updateRangeLabels();

    d3.selectAll(".region-checkbox").on("change", function () {
      updateActiveRegions();
      redrawDashboard(getYearFilter());
    });

    lifeMinInput.on("input", function () {
      syncLifeRange("min");
      redrawDashboard(getYearFilter());
    });

    lifeMaxInput.on("input", function () {
      syncLifeRange("max");
      redrawDashboard(getYearFilter());
    });

    co2MinInput.on("input", function () {
      syncCo2Range("min");
      redrawDashboard(getYearFilter());
    });

    co2MaxInput.on("input", function () {
      syncCo2Range("max");
      redrawDashboard(getYearFilter());
    });

    resetBtn.on("click", () => {
      document.querySelectorAll(".income-checkbox").forEach((cb) => {
        cb.checked = true;
      });
      document.querySelectorAll(".region-checkbox").forEach((cb) => {
        cb.checked = true;
      });

      updateActiveIncomeGroups();
      updateActiveRegions();

      lifeMinInput.property("value", lifeExtent[0]);
      lifeMaxInput.property("value", lifeExtent[1]);
      co2MinInput.property("value", co2Extent[0]);
      co2MaxInput.property("value", co2Extent[1]);

      syncLifeRange("min");
      syncCo2Range("min");
      redrawDashboard(getYearFilter());
    });
  });

  // Configure slider
  slider
    .attr("min", ALL_YEARS_VALUE)
    .attr("max", END_YEAR)
    .attr("step", 1)
    .attr("value", ALL_YEARS_VALUE);

  renderYearTicks();

  // Initial label + render
  yearLabel.text(ALL_YEARS_LABEL);
  updateActiveIncomeGroups();
  updateActiveRegions();
  redrawDashboard(ALL_YEARS_VALUE);

  // Slider interaction
  slider.on("input", function () {
    const year = +this.value;
    yearLabel.text(year === ALL_YEARS_VALUE ? ALL_YEARS_LABEL : year);
    redrawDashboard(year);
    stopPlaying();
  });

  d3.selectAll(".income-checkbox").on("change", function () {
    updateActiveIncomeGroups();
    redrawDashboard(getYearFilter());
  });

  // Play / Pause button
  playBtn.on("click", togglePlay);
});

// Play / Pause logic
function togglePlay() {
  if (isPlaying) {
    stopPlaying();
  } else {
    startPlaying();
  }
}

function startPlaying() {
  isPlaying = true;
  playBtn.text("⏸ Pause");

  slider.property("value", START_YEAR);
  yearLabel.text(START_YEAR);
  redrawDashboard(START_YEAR);

  const dataYears = d3.range(START_YEAR, END_YEAR + 1);
  let currentIndex = 0;

  playInterval = setInterval(() => {
    if (currentIndex < dataYears.length - 1) {
      currentIndex++;
      const nextYear = dataYears[currentIndex];
      slider.property("value", nextYear);
      yearLabel.text(nextYear);
      redrawDashboard(nextYear);
    } else {
      // When playback finishes, default back to "All Year"
      slider.property("value", ALL_YEARS_VALUE);
      yearLabel.text(ALL_YEARS_LABEL);
      redrawDashboard(ALL_YEARS_VALUE);
      stopPlaying();
    }
  }, 1200);
}

function stopPlaying() {
  isPlaying = false;
  playBtn.text("▶ Play");
  clearInterval(playInterval);
}

// ---------- Chart insight tooltips ----------
const chartInsightText = {
  chart1: "Generating insight...",
  chart2: "Generating insight...",
  chart3: "Generating insight...",
  chart4: "Generating insight...",
  chart5: "Generating insight...",
  chart6: "Generating insight...",
};

let insightDataCache = null;
const missingVariablesForInsight = [
  "corruption",
  "sanitation",
  "education_exp_pct",
  "undernourishment",
  "health_exp_pct",
  "unemployment",
  "co2",
];

function showInfoTooltip(event, text) {
  const infoTooltip = document.getElementById("info-tooltip");
  if (!infoTooltip) return;

  infoTooltip.textContent = text;
  infoTooltip.style.opacity = "1";
  infoTooltip.style.left = `${event.pageX + 12}px`;
  infoTooltip.style.top = `${event.pageY + 12}px`;
}

function hideInfoTooltip() {
  const infoTooltip = document.getElementById("info-tooltip");
  if (!infoTooltip) return;
  infoTooltip.style.opacity = "0";
}

function attachInfoButtons() {
  document.querySelectorAll(".chart-info-btn").forEach((btn) => {
    const key = btn.dataset.chart;

    btn.addEventListener("mouseenter", (event) => {
      showInfoTooltip(event, chartInsightText[key] || "Insight unavailable.");
    });

    btn.addEventListener("mousemove", (event) => {
      showInfoTooltip(event, chartInsightText[key] || "Insight unavailable.");
    });

    btn.addEventListener("mouseleave", hideInfoTooltip);

    btn.addEventListener("focus", (event) => {
      showInfoTooltip(event, chartInsightText[key] || "Insight unavailable.");
    });

    btn.addEventListener("blur", hideInfoTooltip);
  });
}

function avg(values) {
  return values.length ? d3.mean(values) : null;
}

function applyBaseFilters(rows, selectedYear, options = {}) {
  const { requireCo2 = false } = options;
  const activeIncome =
    window.activeIncomeGroups instanceof Set ? window.activeIncomeGroups : null;
  const regions = dashboardFilters?.regions || new Set();
  const lifeRange = dashboardFilters?.lifeRange || { min: null, max: null };
  const co2Range = dashboardFilters?.co2Range || { min: null, max: null };

  return rows.filter((d) => {
    if (activeIncome && d.income_group && !activeIncome.has(d.income_group)) {
      return false;
    }

    if (regions.size && d.region && !regions.has(d.region)) {
      return false;
    }

    if (
      Number.isFinite(selectedYear) &&
      Number.isFinite(d.year) &&
      d.year !== selectedYear
    ) {
      return false;
    }

    if (Number.isFinite(d.life_expectancy)) {
      if (lifeRange.min != null && d.life_expectancy < lifeRange.min)
        return false;
      if (lifeRange.max != null && d.life_expectancy > lifeRange.max)
        return false;
    }

    if (requireCo2) {
      if (!Number.isFinite(d.co2) || d.co2 <= 0) return false;
      if (co2Range.min != null && d.co2 < co2Range.min) return false;
      if (co2Range.max != null && d.co2 > co2Range.max) return false;
    }

    return true;
  });
}

function updateChartInsights(selectedYear) {
  if (!insightDataCache) return;

  const lifeRows = applyBaseFilters(insightDataCache.life, selectedYear);
  const scatterRows = applyBaseFilters(insightDataCache.life, selectedYear, {
    requireCo2: true,
  });

  const yearContext = Number.isFinite(selectedYear)
    ? `in ${selectedYear}`
    : "across selected years";

  // Chart 1
  const countryMeans = d3
    .rollups(
      lifeRows.filter((d) => Number.isFinite(d.life_expectancy)),
      (v) => d3.mean(v, (d) => d.life_expectancy),
      (d) => d.country,
    )
    .map(([country, meanLife]) => ({ country, meanLife }))
    .sort((a, b) => b.meanLife - a.meanLife);

  if (countryMeans.length >= 2) {
    const top = countryMeans[0];
    const bottom = countryMeans[countryMeans.length - 1];
    chartInsightText.chart1 = `Auto insight (${yearContext}): ${top.country} is highest (~${top.meanLife.toFixed(
      1,
    )} years) and ${bottom.country} is lowest (~${bottom.meanLife.toFixed(1)} years), showing a ${(top.meanLife - bottom.meanLife).toFixed(1)}-year gap under current filters.`;
  } else {
    chartInsightText.chart1 = `Auto insight (${yearContext}): Not enough filtered data for cross-country comparison.`;
  }

  // Chart 2
  if (scatterRows.length >= 8) {
    const xMean = d3.mean(scatterRows, (d) => Math.log(d.co2));
    const yMean = d3.mean(scatterRows, (d) => d.life_expectancy);
    const cov = d3.mean(
      scatterRows,
      (d) => (Math.log(d.co2) - xMean) * (d.life_expectancy - yMean),
    );
    const xSd = Math.sqrt(
      d3.mean(scatterRows, (d) => (Math.log(d.co2) - xMean) ** 2),
    );
    const ySd = Math.sqrt(
      d3.mean(scatterRows, (d) => (d.life_expectancy - yMean) ** 2),
    );
    const corr = xSd && ySd ? cov / (xSd * ySd) : 0;

    chartInsightText.chart2 = `Auto insight (${yearContext}): Filtered CO₂ vs life expectancy relationship is ${corr >= 0 ? "positive" : "negative"} (r ≈ ${corr.toFixed(
      2,
    )}). ${scatterRows.length} country-year records satisfy the current filters.`;
  } else {
    chartInsightText.chart2 = `Auto insight (${yearContext}): Too few filtered points for a reliable CO₂ relationship.`;
  }

  // Chart 3
  const incomeSeries = d3
    .rollups(
      lifeRows.filter((d) => Number.isFinite(d.life_expectancy)),
      (v) => {
        const sorted = [...v].sort((a, b) => a.year - b.year);
        const start = sorted[0]?.life_expectancy;
        const end = sorted[sorted.length - 1]?.life_expectancy;
        return {
          start,
          end,
          gain:
            Number.isFinite(start) && Number.isFinite(end) ? end - start : null,
        };
      },
      (d) => d.income_group,
    )
    .map(([group, stats]) => ({ group, ...stats }))
    .filter((d) => d.group && Number.isFinite(d.gain))
    .sort((a, b) => b.gain - a.gain);

  if (incomeSeries.length) {
    const top = incomeSeries[0];
    chartInsightText.chart3 = `Auto insight (${yearContext}): ${top.group} shows the strongest filtered improvement (${top.gain.toFixed(
      1,
    )} years from ${top.start.toFixed(1)} to ${top.end.toFixed(1)}).`;
  } else {
    chartInsightText.chart3 = `Auto insight (${yearContext}): Not enough filtered income-group trend data.`;
  }

  // Chart 4
  const regionStats = d3
    .rollups(
      lifeRows.filter((d) => Number.isFinite(d.life_expectancy)),
      (v) => {
        const sorted = [...v].sort((a, b) => a.year - b.year);
        const latest = sorted[sorted.length - 1]?.life_expectancy;
        const start = sorted[0]?.life_expectancy;
        return {
          latest,
          gain:
            Number.isFinite(start) && Number.isFinite(latest)
              ? latest - start
              : null,
        };
      },
      (d) => d.region,
    )
    .map(([region, stats]) => ({ region, ...stats }));

  const topRegion = [...regionStats]
    .filter((d) => Number.isFinite(d.latest))
    .sort((a, b) => b.latest - a.latest)[0];

  if (topRegion) {
    chartInsightText.chart4 = `Auto insight (${yearContext}): ${topRegion.region} has the highest filtered regional life expectancy (~${topRegion.latest.toFixed(
      1,
    )} years).`;
  } else {
    chartInsightText.chart4 = `Auto insight (${yearContext}): Not enough filtered regional data.`;
  }

  // Chart 5 (AUC by income group)
  const aucByIncome = d3
    .rollups(
      lifeRows.filter((d) => Number.isFinite(d.life_expectancy)),
      (groupRows) => {
        const yearlyMeans = d3
          .rollups(
            groupRows,
            (v) => d3.mean(v, (d) => d.life_expectancy),
            (d) => d.year,
          )
          .map(([year, life]) => ({ year, life }))
          .filter((d) => Number.isFinite(d.life))
          .sort((a, b) => a.year - b.year);

        if (!yearlyMeans.length) return null;
        if (yearlyMeans.length === 1) {
          return {
            aucRaw: yearlyMeans[0].life,
            aucNormalized: yearlyMeans[0].life,
            spanYears: 1,
          };
        }

        let aucRaw = 0;
        for (let i = 0; i < yearlyMeans.length - 1; i += 1) {
          const left = yearlyMeans[i];
          const right = yearlyMeans[i + 1];
          aucRaw += ((left.life + right.life) / 2) * (right.year - left.year);
        }

        const spanYears = Math.max(
          1,
          yearlyMeans[yearlyMeans.length - 1].year - yearlyMeans[0].year,
        );

        return {
          aucRaw,
          aucNormalized: aucRaw / spanYears,
          spanYears,
        };
      },
      (d) => d.income_group,
    )
    .map(([group, stats]) => ({ group, ...stats }))
    .filter((d) => d.group && d && Number.isFinite(d.aucNormalized))
    .sort((a, b) => b.aucNormalized - a.aucNormalized);

  if (aucByIncome.length >= 2) {
    const top = aucByIncome[0];
    const bottom = aucByIncome[aucByIncome.length - 1];
    const gap = top.aucNormalized - bottom.aucNormalized;
    chartInsightText.chart5 = `Auto insight (${yearContext}): ${top.group} has the strongest cumulative life expectancy profile (AUC-normalized ≈ ${top.aucNormalized.toFixed(
      2,
    )}), while ${bottom.group} is lowest (≈ ${bottom.aucNormalized.toFixed(
      2,
    )}). Gap: ${gap.toFixed(2)} years.`;
  } else if (aucByIncome.length === 1) {
    const only = aucByIncome[0];
    chartInsightText.chart5 = `Auto insight (${yearContext}): Only ${only.group} remains under current filters (AUC-normalized ≈ ${only.aucNormalized.toFixed(
      2,
    )}).`;
  } else {
    chartInsightText.chart5 = `Auto insight (${yearContext}): Not enough filtered records to compute AUC-based comparison.`;
  }

  // Chart 6
  const advancedRows = applyBaseFilters(
    insightDataCache.advanced,
    selectedYear,
  );

  if (!advancedRows.length) {
    chartInsightText.chart6 = `Auto insight (${yearContext}): Not enough filtered rows to assess missingness.`;
  } else {
    const missingStats = missingVariablesForInsight
      .map((key) => {
        const count = advancedRows.reduce(
          (acc, row) => (row[key] == null ? acc + 1 : acc),
          0,
        );
        return {
          key,
          count,
          ratio: count / advancedRows.length,
        };
      })
      .sort((a, b) => b.ratio - a.ratio);

    const topMissing = missingStats[0];
    chartInsightText.chart6 = `Auto insight (${yearContext}): Most missing column is ${topMissing.key} with ${topMissing.count} missing values (${(
      topMissing.ratio * 100
    ).toFixed(1)}%).`;
  }
}

function initChartInsights() {
  Promise.all([
    d3.csv("dataset/life_expectancy_clean.csv"),
    d3.csv("dataset/life_expectancy_advanced.csv"),
  ])
    .then(([lifeRaw, advancedRaw]) => {
      insightDataCache = {
        life: lifeRaw.map((d) => ({
          country: d.country,
          country_code: d.country_code,
          income_group: d.income_group,
          region: d.region,
          year: +d.year,
          life_expectancy: +d.life_expectancy,
          co2: d.co2 === "" ? null : +d.co2,
        })),
        advanced: advancedRaw.map((d) => ({
          income_group: d.income_group,
          region: d.region,
          year: +d.year,
          life_expectancy: d.life_expectancy === "" ? null : +d.life_expectancy,
          life_expectancy_5yr_avg:
            d.life_expectancy_5yr_avg === ""
              ? null
              : +d.life_expectancy_5yr_avg,
          co2_missing: d.co2 === "",
          corruption: d.corruption === "" ? null : +d.corruption,
          sanitation: d.sanitation === "" ? null : +d.sanitation,
          education_exp_pct:
            d.education_exp_pct === "" ? null : +d.education_exp_pct,
          undernourishment:
            d.undernourishment === "" ? null : +d.undernourishment,
          health_exp_pct: d.health_exp_pct === "" ? null : +d.health_exp_pct,
          unemployment: d.unemployment === "" ? null : +d.unemployment,
          co2: d.co2 === "" ? null : +d.co2,
        })),
      };

      const currentYear = getYearFilter();
      updateChartInsights(currentYear === ALL_YEARS_VALUE ? null : currentYear);
    })
    .catch(() => {
      Object.keys(chartInsightText).forEach((key) => {
        chartInsightText[key] = "Unable to generate insight from dataset.";
      });
    });
}

attachInfoButtons();
initChartInsights();

// Panel collapse/expand functionality
const filterPanel = document.querySelector('.filter-panel');
const filterCollapseBtn = document.querySelector('.filter-collapse-btn');
const filterExpandBtn = document.querySelector('.filter-expand-btn');
const timelinePanel = document.querySelector('.timeline-panel');
const timelineCollapseBtn = document.querySelector('.timeline-collapse-btn');
const timelineExpandBtn = document.querySelector('.timeline-expand-btn');
const container = document.querySelector('.container-xxl');

// Function to update container padding when panels are collapsed/expanded
function updateContainerPadding() {
  const filterWidth = filterPanel.classList.contains('collapsed') ? 70 : 320;
  const timelineWidth = timelinePanel.classList.contains('collapsed') ? 70 : 320;
  
  container.style.paddingLeft = `${filterWidth}px`;
  container.style.paddingRight = `${timelineWidth}px`;
}

// Filter panel collapse
filterCollapseBtn.addEventListener('click', () => {
  filterPanel.classList.add('collapsed');
  filterCollapseBtn.setAttribute('aria-label', 'Expand filter panel');
  updateContainerPadding();
});

// Filter panel expand
filterExpandBtn.addEventListener('click', () => {
  filterPanel.classList.remove('collapsed');
  filterCollapseBtn.setAttribute('aria-label', 'Collapse filter panel');
  updateContainerPadding();
});

// Timeline panel collapse
timelineCollapseBtn.addEventListener('click', () => {
  timelinePanel.classList.add('collapsed');
  timelineCollapseBtn.setAttribute('aria-label', 'Expand timeline panel');
  updateContainerPadding();
});

// Timeline panel expand
timelineExpandBtn.addEventListener('click', () => {
  timelinePanel.classList.remove('collapsed');
  timelineCollapseBtn.setAttribute('aria-label', 'Collapse timeline panel');
  updateContainerPadding();
});

// Initialize container padding
updateContainerPadding();
