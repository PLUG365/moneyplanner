# Third Party Notices

This app uses open source software from the JavaScript, Expo, React Native, Firebase, and related ecosystems.

The production dependency license inventory is generated from `package-lock.json` with:

```powershell
npx --yes license-checker --production --csv --relativeLicensePath --out docs/third-party-licenses.csv
```

The generated inventory is available at [docs/third-party-licenses.csv](docs/third-party-licenses.csv).

## License Summary

Generated on 2026-06-30 from production dependencies:

| License                             | Count |
| ----------------------------------- | ----: |
| MIT                                 |   571 |
| Apache-2.0                          |    69 |
| ISC                                 |    41 |
| BSD-3-Clause                        |    28 |
| BlueOak-1.0.0                       |     9 |
| BSD-2-Clause                        |     8 |
| Unlicense                           |     2 |
| 0BSD                                |     2 |
| MPL-2.0                             |     2 |
| (MIT OR CC0-1.0)                    |     2 |
| Python-2.0                          |     1 |
| CC-BY-4.0                           |     1 |
| UNLICENSED                          |     1 |
| (BSD-3-Clause OR GPL-2.0)           |     1 |
| Apache 2.0                          |     1 |
| (BSD-2-Clause OR MIT OR Apache-2.0) |     1 |

`UNLICENSED` refers to the private application package itself, not a third-party production dependency requiring redistribution.

## Release Notes

Before App Store submission, regenerate [docs/third-party-licenses.csv](docs/third-party-licenses.csv) after dependency changes and confirm that no unexpected copyleft or unknown licenses have been introduced. If a dependency requires a full license text or attribution notice beyond the generated inventory, add that notice here before release.
