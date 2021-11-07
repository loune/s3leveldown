# Changelog

## [2.2.2] - 2021-11-07

### Changed

- Move `levelup` to peer dependency and support `^5.1.1`.

## [2.2.1] - 2021-02-14

### Changed

- Improve TypeScript definition.

## [2.2.0] - 2021-02-05

### Added

- TypeScript types.

### Changed

- Update dependencies.

## [2.1.0] - 2020-04-05

### Changed

- Update `abstract-leveldown`.

### Fixed

- S3 client now passed to constructor in function (#2).

## [2.0.0] - 2019-04-27

### Changed

- Support LevelDOWN `4.0.1`.
- Support new `abstract-leveldown` `6.0.3` tests.
- Constructor now takes `location` and `s3` parameters.
- `open` now creates the S3 bucket if `createIfMissing` is `true`

## [1.0.0] - 2017-02-05

- Initial Release
