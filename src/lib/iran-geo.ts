import iranCities from "iran-cities-json";

const { ostan, shahr } = iranCities;

const collator = new Intl.Collator("fa");

// حروف عربی را فارسی می‌کند و بعد از «و» اگر فاصله نیست، فاصله می‌گذارد
const clean = (value: string) =>
  value
    .replace(/ي/g, "ی")
    .replace(/ك/g, "ک")
    .replace(/ (?=و\S)/g, " ")
    .replace(/ و(?=\S)/g, " و ")
    .replace(/\s+/g, " ")
    .trim();

const provinces = ostan
  .map((province) => ({ id: province.id, name: clean(province.name) }))
  .sort((a, b) => collator.compare(a.name, b.name));

const citiesByProvinceId = new Map<number, Set<string>>();

for (const city of shahr) {
  if (city.ostan == null) continue;

  const set = citiesByProvinceId.get(city.ostan) ?? new Set<string>();
  set.add(clean(city.name));
  citiesByProvinceId.set(city.ostan, set);
}

export const IRAN_PROVINCES = provinces.map((province) => province.name);

const provinceByName = new Map(
  provinces.map((province) => [province.name, province.id]),
);

export const isValidProvince = (name: string) => provinceByName.has(name);

export const isValidCity = (provinceName: string, cityName: string) => {
  const id = provinceByName.get(provinceName);

  if (id === undefined) return false;

  return citiesByProvinceId.get(id)?.has(cityName) ?? false;
};