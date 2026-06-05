# Train timetable data (Transport NSW PDFs)

Official weekday timetables imported from [transportnsw.info](https://transportnsw.info) PDFs. The app uses these as **scheduled** departure times (Sydney local), refreshed every 15 seconds to show the next upcoming services.

## Supported lines

| Line | PDF |
|------|-----|
| T1 Western | [93-T1-Western-Line-20260419.pdf](https://transportnsw.info/documents/timetables/93-T1-Western-Line-20260419.pdf) |
| T8 Airport & South | [93-T8-Airport-South-Line-20251019.pdf](https://transportnsw.info/documents/timetables/93-T8-Airport-South-Line-20251019.pdf) |
| T2 / T3 Inner West & Liverpool | [93-T2-Inner-West-Leppington-Line-20250629.pdf](https://transportnsw.info/documents/timetables/93-T2-Inner-West-Leppington-Line-20250629.pdf) |
| T4 Eastern Suburbs & Illawarra | [93-T4-Eastern-Suburbs-Illawarra-Line-20260419.pdf](https://transportnsw.info/documents/timetables/93-T4-Eastern-Suburbs-Illawarra-Line-20260419.pdf) |
| T5 Cumberland | [93-T5-Cumberland-Line-20250419.pdf](https://transportnsw.info/documents/timetables/93-T5-Cumberland-Line-20250419.pdf) |
| T6 Lidcombe & Bankstown | [93-T6-Lidcombe-Bankstown-Line-20241020.pdf](https://transportnsw.info/documents/timetables/93-T6-Lidcombe-Bankstown-Line-20241020.pdf) |
| T7 Olympic Park | [93-T7-Olympic-Park-Line-20241020.pdf](https://transportnsw.info/documents/timetables/93-T7-Olympic-Park-Line-20241020.pdf) |
| T9 Northern | [93-T9-Northern-Line-20250419.pdf](https://transportnsw.info/documents/timetables/93-T9-Northern-Line-20250419.pdf) |
| L1 Dulwich Hill | [93-L1-Dulwich-Hill-Line-20260119.pdf](https://transportnsw.info/documents/timetables/93-L1-Dulwich-Hill-Line-20260119.pdf) |
| L2 Randwick | [93-L2-Randwick-Line-20260119.pdf](https://transportnsw.info/documents/timetables/93-L2-Randwick-Line-20260119.pdf) |
| L3 Kingsford | [93-L3-Kingsford-Line-20260119.pdf](https://transportnsw.info/documents/timetables/93-L3-Kingsford-Line-20260119.pdf) |

## Import all timetables

```bash
npm run import:timetables
```

Import one line only:

```bash
node scripts/import-train-timetables.mjs T4
```

This downloads PDFs into `source/`, extracts text, and writes:

- `t1-weekday.json`, `t2-weekday.json`, … `t9-weekday.json`
- `manifest.json` — summary of imported lines

## How the app uses them

1. **Backend** merges all `*-weekday.json` files per station.
2. **`GET /api/departures?stationId=CENTRAL_T`** returns the next 20 services from the merged schedule when live TfNSW data is unavailable.
3. **Expo app** polls every **15 seconds** via React Query so countdowns stay aligned with the current Sydney time.

Response source field: `"timetable-pdf"`.

## Adding a new PDF

1. Add a config entry in `scripts/import-train-timetables.mjs` (`LINE_PDF_CONFIGS`).
2. Add any missing station aliases in `stationNameMap.js`.
3. Run `npm run import:timetables`.

Station IDs must match `backend/data/app-data.json`.
