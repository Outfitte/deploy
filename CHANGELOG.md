# Changelog

All notable changes to this project will be documented in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
This project uses [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

> **0.x stability note:** while the version is below 1.0.0, the REST API contract
> and Docker Compose interface may change between releases without a deprecation
> period. Pin to a specific image tag in production and review this file before
> upgrading.

## [Unreleased]

## [0.1.0] - 2026-06-09

### Added

- **Wardrobe items** — add, edit, archive, and tag clothing and accessory items
  with name, category, colour, brand, size, purchase date, cost, and notes.
- **Photos** — attach one or more photos to any item; images are stored and
  served from the self-hosted media volume.
- **Locations** — organise items by physical location (drawer, shelf, suitcase,
  etc.) and filter the wardrobe view by location.
- **Wear logging** — record every time an item is worn; view wear history and
  per-item wear counts.
- **Outfits** — group items into named outfit combinations; schedule outfits on
  an interactive calendar and view past and upcoming planned outfits.
- **Sharing** — share individual items or entire outfits with other registered
  users via a shareable link.
- **Item transfer** — transfer ownership of an item to another user; the item
  moves to the recipient's wardrobe with full history intact.
- **Family / multi-user** — invite family members to join an account group;
  each member maintains their own wardrobe while sharing a single deployment.
- **Docker Compose self-hosting** — deploy the full stack (Go backend + Nginx
  frontend + SQLite) with a single `docker compose up -d`; images published to
  GHCR (`ghcr.io/outfitte/backend` and `ghcr.io/outfitte/frontend`).

[Unreleased]: https://github.com/Outfitte/deploy/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/Outfitte/deploy/releases/tag/v0.1.0
