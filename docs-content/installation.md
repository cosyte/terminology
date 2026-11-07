---
id: installation
title: Installation
sidebar_position: 1
description: "Install @cosyte/terminology from npm and check that it loads."
---

# Installation

`@cosyte/terminology` is a zero-dependency TypeScript package for Node.js. It ships dual **ESM + CJS** builds with
per-condition type declarations, so it works from either module system without configuration.

> **Status:** the 0.1 line, published on npm. The command below installs the real package.

## Prerequisites

- **Node.js 22 or later, tested on 22 and 24.**
- A package manager: `pnpm`, `npm`, or `yarn`.

## Install

```bash
npm install @cosyte/terminology
```

## Smoke test

Confirm the package resolves and its version symbol is present:

```ts
import { VERSION } from "@cosyte/terminology";

console.log(VERSION);
```

If that prints a version string, the install is good: head to the [Quickstart](./quickstart).
