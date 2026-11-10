---
id: installation
title: Installation
sidebar_label: Installation
description: "Install @cosyte/terminology from npm, check that it loads, and import it from an ES module or CommonJS."
---

# Installation

## Prerequisites

- Node.js 22 or later. CI runs on Node.js 22, 24 and 26.
- A package manager: npm, pnpm or yarn.

The package has no runtime dependencies.

## Install

```bash
npm install @cosyte/terminology
```

Or `pnpm add @cosyte/terminology`, or `yarn add @cosyte/terminology`.

## Check that it loads

```ts runnable
import { VERSION } from "@cosyte/terminology";

typeof VERSION; // => "string"
```

`VERSION` is the installed version, the same string as the package's `package.json`.

## ES modules and CommonJS

The package ships an ES module build and a CommonJS build, each with its own type declarations, so it
loads from either module system with no configuration. From CommonJS:

```js no-run CommonJS: the sample runner loads every sample as an ES module, where require is not defined
const { resolveSystem } = require("@cosyte/terminology");

console.log(resolveSystem("LN").url); // http://loinc.org
```

## Next

The [quickstart](./quickstart.md) takes you from here to a first translated code.
