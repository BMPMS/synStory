// PubMed search-result counts by year (step 7 — "This is not old news").
// Raw export is sparse: a year with zero matching papers simply doesn't
// appear as a row. For a publication-count-over-time line/area chart that
// matters — a straight line drawn across a missing decade would read as
// gradual growth instead of the true "nothing, then a paper, then nothing
// again" pattern — so every year in [minYear, maxYear] is densified to an
// explicit 0 below, from this raw sparse export.
const raw = [
  { year: 2026, count: 28 },
  { year: 2025, count: 26 },
  { year: 2024, count: 31 },
  { year: 2023, count: 25 },
  { year: 2022, count: 33 },
  { year: 2021, count: 41 },
  { year: 2020, count: 37 },
  { year: 2019, count: 62 },
  { year: 2018, count: 48 },
  { year: 2017, count: 64 },
  { year: 2016, count: 47 },
  { year: 2015, count: 70 },
  { year: 2014, count: 73 },
  { year: 2013, count: 89 },
  { year: 2012, count: 71 },
  { year: 2011, count: 64 },
  { year: 2010, count: 33 },
  { year: 2009, count: 54 },
  { year: 2008, count: 37 },
  { year: 2007, count: 38 },
  { year: 2006, count: 45 },
  { year: 2005, count: 19 },
  { year: 2004, count: 8 },
  { year: 2003, count: 7 },
  { year: 2002, count: 9 },
  { year: 2001, count: 9 },
  { year: 1999, count: 3 },
  { year: 1997, count: 3 },
  { year: 1996, count: 4 },
  { year: 1995, count: 2 },
  { year: 1993, count: 1 },
  { year: 1992, count: 1 },
  { year: 1991, count: 1 },
  { year: 1990, count: 1 },
  { year: 1989, count: 3 },
  { year: 1988, count: 1 },
  { year: 1987, count: 3 },
  { year: 1985, count: 1 },
  { year: 1984, count: 1 },
  { year: 1983, count: 1 },
  { year: 1982, count: 4 },
  { year: 1981, count: 1 },
  { year: 1979, count: 2 },
  { year: 1975, count: 1 },
  { year: 1972, count: 1 },
  { year: 1969, count: 1 },
  { year: 1966, count: 1 },
  { year: 1956, count: 1 },
  { year: 1955, count: 1 },
  { year: 1949, count: 1 },
  { year: 1947, count: 1 },
  { year: 1812, count: 1 },
  { year: 1813, count: 1 },
  { year: 1824, count: 1 },
  { year: 1826, count: 1 },
  { year: 1835, count: 1 },
  { year: 1848, count: 2 },
  { year: 1849, count: 1 },
  { year: 1851, count: 1 },
  { year: 1852, count: 2 },
  { year: 1857, count: 1 },
  { year: 1863, count: 1 },
  { year: 1864, count: 3 },
  { year: 1865, count: 3 },
  { year: 1866, count: 1 },
  { year: 1872, count: 1 },
  { year: 1873, count: 4 },
  { year: 1874, count: 2 },
  { year: 1875, count: 2 },
  { year: 1876, count: 1 },
  { year: 1877, count: 1 },
  { year: 1879, count: 1 },
  { year: 1880, count: 2 },
  { year: 1881, count: 1 },
  { year: 1882, count: 1 },
  { year: 1883, count: 2 },
  { year: 1892, count: 1 },
  { year: 1893, count: 1 },
  { year: 1895, count: 1 },
  { year: 1896, count: 1 },
  { year: 1899, count: 1 },
  { year: 1920, count: 2 },
  { year: 1921, count: 2 },
  { year: 1922, count: 3 },
  { year: 1923, count: 2 },
  { year: 1924, count: 1 },
  { year: 1925, count: 1 },
  { year: 1926, count: 1 },
  { year: 1928, count: 1 },
  { year: 1929, count: 1 },
  { year: 1930, count: 2 },
  { year: 1931, count: 1 },
  { year: 1932, count: 2 },
  { year: 1933, count: 1 },
  { year: 1934, count: 1 },
  { year: 1935, count: 1 },
  { year: 1938, count: 1 },
  { year: 1940, count: 1 },
  { year: 1942, count: 2 },
  { year: 1944, count: 1 },

];

const minYear = Math.min(...raw.map((d) => d.year));
const maxYear = Math.max(...raw.map((d) => d.year));
const countByYear = new Map(raw.map((d) => [d.year, d.count]));

export const publications = [];
for (let year = minYear; year <= maxYear; year++) {
  publications.push({ year, count: countByYear.get(year) ?? 0 });
}

export const publicationsMinYear = minYear;
export const publicationsMaxYear = maxYear;
export const publicationsMaxCount = Math.max(...raw.map((d) => d.count));

// Bryony: "let's bin the data into decades (but keep the line)" — the
// same yearly counts above, summed into one point per decade (a true
// bin total, never an average), still shaped as {year, count} so the
// chart's existing line/area generators need no changes, just this
// array in place of `publications`. Each point's `year` is the MIDPOINT
// of whichever years that decade actually spans within our data — EXCEPT
// the first and last bucket, pinned to minYear/maxYear exactly instead:
// the first only covers 1947–1949 and the last only 2020–2026, so their
// own midpoints (1948, 2023) sat well short of the chart's real x-axis
// scaleLinear domain edges, leaving a visible gap between the drawn
// line and the axis. Pinning to minYear/maxYear (not each bucket's own
// calendar-decade start, e.g. 1940/2020 — that sits OUTSIDE the domain
// and would get clipped) closes that gap without changing the linear
// scale or the decade totals themselves.
const decadeBuckets = new Map();
for (const { year, count } of publications) {
  const decadeStart = Math.floor(year / 10) * 10;
  if (!decadeBuckets.has(decadeStart)) decadeBuckets.set(decadeStart, { years: [], total: 0 });
  const bucket = decadeBuckets.get(decadeStart);
  bucket.years.push(year);
  bucket.total += count;
}

export const publicationsByDecade = Array.from(decadeBuckets.entries())
  .sort(([a], [b]) => a - b)
  .map(([decadeStart, { years, total }], i, arr) => ({
    decade: decadeStart,
    year: i === 0 ? minYear : i === arr.length - 1 ? maxYear : (Math.min(...years) + Math.max(...years)) / 2,
    count: total
  }));

export const publicationsByDecadeMaxCount = Math.max(...publicationsByDecade.map((d) => d.count));
