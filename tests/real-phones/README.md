# Real phone photos and videos (test data)

Photos and videos taken by real iPhones and Samsung phones, used by `tests/real-phones.test.ts`
to check that real camera files land in Keep with the right date. None of these are the
project owner's or any team member's photos.

## Source and licence

All files are unmodified copies from the public sample collection
<https://github.com/drewnoakes/metadata-extractor-images> (commit `651ad0e67aa8d43d358ad05f9bc07b52d8b9ac6e`),
gathered by the metadata-extractor project. Its README says:

> You are free to use these media files however you wish.

Only the file names were changed (original names below). These files are test data only: they
are not in `public/`, not bundled into any build, and not shipped with the app, so they don't
need an entry in `public/THIRD_PARTY_NOTICES.txt` (that file lists software shipped in the app).
This README is their attribution.

Expected dates were checked against the collection's own metadata dumps
(`<type>/metadata/java/<name>.txt`).

## Files

Every file was checked byte by byte: each photo has its full picture data (JPEGs: complete
scan data ending in the FFD9 end marker; HEIC: 'mdat' box with all the picture tiles; videos:
complete 'mdat' and 'moov'). None are metadata-only stubs.

| File | Original name | Bytes | What it is | Date taken (expected) |
|---|---|---|---|---|
| `iphone-8_IMG_1034.heic` | `heic/IMG_1034.heic` | 1,499,892 | iPhone 8 (iOS 11.2.2) HEIC, 4032x3024 grid of 512x512 tiles, 320x240 thumbnail, 'meta' before 'mdat' | 2018-02-05 15:11:44 |
| `iphone-11-pro_IMG_2927.HEIC` | `heic/IMG_2927.HEIC` | 721,093 | iPhone 11 Pro (iOS 13.4.1) HEIC, brands mif1/miaf/MiHB, upper-case extension. Its grid 'ispe' says 3024x4032 (portrait), although Exif says 4032x3024 | 2020-05-04 18:39:11 |
| `samsung-galaxy-s10plus_SM-G975F.heic` | `heic/Issue 487.heic` | 1,622,642 | Samsung Galaxy S10+ HEIC, 4032x3024: 'mdat' first, 'meta' after it, then a Samsung 'sefd' trailer box | 2020-06-30 11:27:59 |
| `iphone-4.jpg` | `jpg/Apple iPhone 4.jpg` | 338,025 | iPhone 4 JPEG, 1296x968 | 2011-01-13 14:33:39 |
| `samsung-galaxy-s_GT-I9000.jpg` | `jpg/Samsung GT-I9000 (Galaxy S).jpg` | 101,329 | Samsung Galaxy S JPEG, 640x480 (small, but has camera details and a date, so it's a real photo) | 2011-04-02 18:30:10 |
| `samsung-galaxy-s4_GT-I9505.jpg` | `jpg/Samsung GT-I9505 (Galaxy S4).jpg` | 1,936,020 | Samsung Galaxy S4 JPEG, 4128x2322 | 2014-11-27 17:52:49 |
| `samsung-galaxy-j3_SM-J327T1.jpg` | `jpg/Samsung SM-J327T1.jpg` | 945,207 | Samsung Galaxy J3 (2017, SM-J327T1) JPEG, 2576x1932 | 2019-09-26 16:38:00 |
| `iphone-6_video.mov` | `mov/with-gps.mov` | 439,391 | iPhone 6 (iOS 12.3) QuickTime video, 'moov' at the end, `com.apple.quicktime.creationdate` = 2019-07-24T11:25:40+0300 | 2019-07-24 11:25:40 (local time from creationdate) |
| `samsung-android_video.mp4` | `mp4/with-gps.mp4` | 242,752 | Samsung Android 6.0.1 phone video (Samsung 'SDLN', 'smrd', 'smta' tags), 1920x1080 H.264, 'moov' at the end. No local-time tag, only 'mvhd' (UTC). GPS puts it near London in February, so UTC is also the local time | 2017-02-22 08:20:28 (mvhd, UTC) |

Total: 9 files, 7,846,351 bytes.

The tests also make, in memory only (never written to disk): a copy of the iPhone 8 HEIC and
of the Galaxy S4 JPEG cut to 60% of their length (expected: damaged, cut off), and an exact copy
of the Galaxy J3 JPEG (expected: exact copy).

SHA-256:

```
f40b97f76a281c56e90b502762ef66ff9d34ea61696c8350257b5dc6a8797e0d  iphone-8_IMG_1034.heic
c00f914293509bc0056c6c8827cbf4dfb089aacb632b4b510276ec95be03097d  iphone-11-pro_IMG_2927.HEIC
edb1aa1895dc2d1b3647c098f18e3671fa0166355469b2d2428274a4d8fd9801  samsung-galaxy-s10plus_SM-G975F.heic
724e74af3f1faa527dee17a38521a3cdc9165b73416785eacdfe5fcf32a48899  iphone-4.jpg
3ad8b0790cdf55b31aa693ea98399b44eddf7239083356a6b93a9027ca472ad6  samsung-galaxy-s_GT-I9000.jpg
6ab77efd68f8e5e2744cec1113bdcd037749f65c87f8267c31588050facb5aea  samsung-galaxy-s4_GT-I9505.jpg
286b9bbfdec932042afbe052250b3df1875fa0730f4a1db236f68deaf9a74940  samsung-galaxy-j3_SM-J327T1.jpg
385b236e314933a9fd37881b75571ea8bcfaae4e86fc1e708fff526897dfa55c  iphone-6_video.mov
e4bc499e4de81cb769d017a3732db01e9b9ee61d059970663d5239051041a616  samsung-android_video.mp4
```
