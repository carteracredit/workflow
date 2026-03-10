# [1.1.0-rc.5](https://github.com/carteracredit/workflow/compare/v1.1.0-rc.4...v1.1.0-rc.5) (2026-03-10)


### Features

* add Message node support with email and SMS configurations ([5a57851](https://github.com/carteracredit/workflow/commit/5a578514ca8457a4cee6c9dd47bbaba13b966306))

# [1.1.0-rc.4](https://github.com/carteracredit/workflow/compare/v1.1.0-rc.3...v1.1.0-rc.4) (2026-03-10)


### Features

* implement variable interpolation in generated strings for workflow code ([4161882](https://github.com/carteracredit/workflow/commit/4161882f90c7941bd933dcaf8f1f7689b19cb3fc))

# [1.1.0-rc.3](https://github.com/carteracredit/workflow/compare/v1.1.0-rc.2...v1.1.0-rc.3) (2026-03-10)


### Features

* introduce output schema editor and variable picker components ([8572bcf](https://github.com/carteracredit/workflow/commit/8572bcfc6a858ce43933a0865dac7556a46735d9))

# [1.1.0-rc.2](https://github.com/carteracredit/workflow/compare/v1.1.0-rc.1...v1.1.0-rc.2) (2026-03-07)


### Features

* enhance SessionControls with compact language and theme switchers ([fff9ad7](https://github.com/carteracredit/workflow/commit/fff9ad71e2ce63417c9c73f11cfdf2b495ea421b))
* enhance workflow definition handling and API method support ([dc9a8f1](https://github.com/carteracredit/workflow/commit/dc9a8f1781026762f1469a46104d990ebc0ea6c4))
* enhance WorkflowList with loading skeleton and improved user interaction ([43c67d8](https://github.com/carteracredit/workflow/commit/43c67d84a5723c542559ecc06f95e739d1a6bc44))

# [1.1.0-rc.1](https://github.com/carteracredit/workflow/compare/v1.0.0...v1.1.0-rc.1) (2026-03-07)


### Bug Fixes

* **ci:** remove hardcoded pnpm v9 from release workflow to match packageManager field ([b771dc5](https://github.com/carteracredit/workflow/commit/b771dc508ab9196b3eeb72033a3df49c93c9145d))
* enhance error handling and update workflow status management in WorkflowList ([0c9dc94](https://github.com/carteracredit/workflow/commit/0c9dc94d43eff8b9c226b27b0758a27cc534a49c))
* prevent definition from being sent during workflow creation ([3af7828](https://github.com/carteracredit/workflow/commit/3af78285807fe64ed8a859ab754f0c9d8367aa06))
* refine semantic validation for const declarations in TypeScript ([4b4e113](https://github.com/carteracredit/workflow/commit/4b4e113701fe3b3b08b5869a6a6b2c4bf0705781))
* standardize code generation references and improve test assertions ([849f083](https://github.com/carteracredit/workflow/commit/849f0839a7125342fe0e2c405463f318e2dbe914))
* update string formatting in code generation tests and implementation ([82ffe58](https://github.com/carteracredit/workflow/commit/82ffe5804313196a8acd9930cc79cf10333ad3cd))


### Features

* add app icon SVG and update top bar to use the icon ([933db00](https://github.com/carteracredit/workflow/commit/933db00f34555ca2a381beb349c3dfa952ad2157))
* add authentication middleware and session management ([6151b80](https://github.com/carteracredit/workflow/commit/6151b8082eefa32af04f05c3278a2bbdcdd49527))
* Add canvas grid styling and tests ([004bf88](https://github.com/carteracredit/workflow/commit/004bf888cf777f39c8bca840bd132c3eaf0a79c6))
* add code generation feature for workflows with validation and syntax highlighting ([4995820](https://github.com/carteracredit/workflow/commit/4995820b526119b87d6d69465394e72b375030b1))
* add function to trim trailing blank lines in generated code ([f36bbca](https://github.com/carteracredit/workflow/commit/f36bbcaab7132fc5eb1534cfaff15bec0cd872f4))
* add logging to getExternalOrigin function in middleware ([68e0c79](https://github.com/carteracredit/workflow/commit/68e0c7948bd49d0e3b6e110cbc861725377c8cd4))
* add major version management in WorkflowEditor and PublishModal ([597cc6f](https://github.com/carteracredit/workflow/commit/597cc6fcff44528d111fb942b72742324bcba57a))
* Add minimap edges and improve node styling ([3fb605e](https://github.com/carteracredit/workflow/commit/3fb605e498d6395fec80fcc3b9e126147ec0a1ff))
* add Next.js router configuration to Home and WorkflowEditor stories ([24ddd29](https://github.com/carteracredit/workflow/commit/24ddd29366b6da4857bd16c618d04a68086d69ab))
* add PublishModal for workflow publishing with progress tracking ([f0f21ea](https://github.com/carteracredit/workflow/commit/f0f21eae33e4e86fb8402846f6a380a98dd62b0a))
* Add redo functionality to workflow editor ([3ab4101](https://github.com/carteracredit/workflow/commit/3ab4101b5adac4121a0a4c88cd73746e2870ac74))
* add SessionControls component for user interaction ([62c8858](https://github.com/carteracredit/workflow/commit/62c8858cabcb39d96800db37b6ec254a2e4ebe96))
* Add Storybook stories for UI components and workflow ([18883b4](https://github.com/carteracredit/workflow/commit/18883b440b514741ffa43dbfd2b9c7aca129bc28))
* add tests for Canvas selection behavior ([4df4d2f](https://github.com/carteracredit/workflow/commit/4df4d2f49349cc8015d96a8ee89a9ea41bd252ae))
* Add toolbar shortcuts and focus management ([85e5828](https://github.com/carteracredit/workflow/commit/85e5828e2d66b33ebf637aecec99443928af628d))
* Allow disabling history recording for node updates ([f818142](https://github.com/carteracredit/workflow/commit/f81814215f023325f46ae03ca0d9c3183e8c2b13))
* enhance code generation and validation with semantic checks ([0748f8b](https://github.com/carteracredit/workflow/commit/0748f8bed7e36c31d72fd8aa7136fff23febdb94))
* enhance error handling in WorkflowEditor and PublishModal ([a15c59a](https://github.com/carteracredit/workflow/commit/a15c59abbf38bf1a4d1dad22b30cf2d0b59ed3ae))
* enhance PublishModal with deployment status and workflow publishing ([dc77885](https://github.com/carteracredit/workflow/commit/dc77885f8656be58812cb3a1bb843ea5fde8e9ce))
* enhance ThemeSwitcher with dropdown menu for theme selection ([631150c](https://github.com/carteracredit/workflow/commit/631150c1624ecfdd23bf4be332c24c49cdc2ac2d))
* enhance workflow testing and configuration ([da93f7a](https://github.com/carteracredit/workflow/commit/da93f7ab917822df7fb8967b9be56c83e2a18f99))
* enhance workflow validation and JSON handling ([e0f4322](https://github.com/carteracredit/workflow/commit/e0f4322cb4e49cf6eecedc2e2ec1e7f280ba0b7d))
* enhance WorkflowList component and Storybook configuration ([7d54835](https://github.com/carteracredit/workflow/commit/7d548359e3890454ea540258d2a6bc8b380c1798))
* implement code formatting for generated TypeScript in publish modal ([7feb628](https://github.com/carteracredit/workflow/commit/7feb6283adf7b34217c3c0cb9b19eb795c262be0))
* implement copy and paste functionality in WorkflowEditor and Canvas ([e502d15](https://github.com/carteracredit/workflow/commit/e502d1531be4ca4dfcfb9d30d2fad501ea529f00))
* Implement multi-node drag and selection ([451d5df](https://github.com/carteracredit/workflow/commit/451d5df0e22466096a0690fccf1cd2c209220881))
* Implement undo/redo functionality for workflow editor ([493c3e9](https://github.com/carteracredit/workflow/commit/493c3e92d7977e52e4afbdac3a0f2e8d1abb354b))
* implement workflow API integration and session management ([c98a48f](https://github.com/carteracredit/workflow/commit/c98a48f7accf5cd208ac70abbb42aec9fac2d30f))
* implement workflow cloning functionality in WorkflowList ([356a60e](https://github.com/carteracredit/workflow/commit/356a60e4d29e45e6435f2db657d68db8346ec3b6))
* implement workflow list and editor pages ([e28643c](https://github.com/carteracredit/workflow/commit/e28643c1d7bd532aac1667ff807a7d1247165968))
* improve class declaration formatting in code generation ([956eaf4](https://github.com/carteracredit/workflow/commit/956eaf4ada9f14ca327be2e180afefba7abe7fc7))
* integrate flag management and state display in WorkflowEditor ([b5ba2a2](https://github.com/carteracredit/workflow/commit/b5ba2a25b559a0f9bf1958751d6e0475c3ce1f14))
* integrate flag retrieval and state management in WorkflowEditor ([37d3275](https://github.com/carteracredit/workflow/commit/37d32753565bb8b9896a8e42a022a982c0911d9d))
* integrate LanguageProvider and enhance Storybook configurations ([370bae0](https://github.com/carteracredit/workflow/commit/370bae0c29a29ea1ee428ad1f2ab21e064146a2a))
* Make paletteProps optional and conditionally render ([14e08d4](https://github.com/carteracredit/workflow/commit/14e08d421f8f7bb531ee3da5341fbf8d48e85b13))
* reorganize keyboard shortcuts in top bar and update layout ([13e9df7](https://github.com/carteracredit/workflow/commit/13e9df7f00765c104112487c928b255dad18ba90))
* shortcuts and add keyboard shortcuts modal with 3-column layout ([f8adb69](https://github.com/carteracredit/workflow/commit/f8adb69e4f39e8f0b173dfb2951dfeb1b0690446))
* update PropertiesPanel to handle mixed selection of nodes and edges ([31c5871](https://github.com/carteracredit/workflow/commit/31c58712c30d5d4fc9b306d6508a0d29db3560f5))

# [1.0.0-rc.18](https://github.com/carteracredit/workflow/compare/v1.0.0-rc.17...v1.0.0-rc.18) (2026-03-06)


### Features

* add SessionControls component for user interaction ([62c8858](https://github.com/carteracredit/workflow/commit/62c8858cabcb39d96800db37b6ec254a2e4ebe96))
* implement workflow cloning functionality in WorkflowList ([356a60e](https://github.com/carteracredit/workflow/commit/356a60e4d29e45e6435f2db657d68db8346ec3b6))

# [1.0.0-rc.17](https://github.com/carteracredit/workflow/compare/v1.0.0-rc.16...v1.0.0-rc.17) (2026-03-04)


### Bug Fixes

* enhance error handling and update workflow status management in WorkflowList ([0c9dc94](https://github.com/carteracredit/workflow/commit/0c9dc94d43eff8b9c226b27b0758a27cc534a49c))
* prevent definition from being sent during workflow creation ([3af7828](https://github.com/carteracredit/workflow/commit/3af78285807fe64ed8a859ab754f0c9d8367aa06))
* refine semantic validation for const declarations in TypeScript ([4b4e113](https://github.com/carteracredit/workflow/commit/4b4e113701fe3b3b08b5869a6a6b2c4bf0705781))


### Features

* add major version management in WorkflowEditor and PublishModal ([597cc6f](https://github.com/carteracredit/workflow/commit/597cc6fcff44528d111fb942b72742324bcba57a))
* add Next.js router configuration to Home and WorkflowEditor stories ([24ddd29](https://github.com/carteracredit/workflow/commit/24ddd29366b6da4857bd16c618d04a68086d69ab))
* enhance code generation and validation with semantic checks ([0748f8b](https://github.com/carteracredit/workflow/commit/0748f8bed7e36c31d72fd8aa7136fff23febdb94))
* enhance workflow validation and JSON handling ([e0f4322](https://github.com/carteracredit/workflow/commit/e0f4322cb4e49cf6eecedc2e2ec1e7f280ba0b7d))
* enhance WorkflowList component and Storybook configuration ([7d54835](https://github.com/carteracredit/workflow/commit/7d548359e3890454ea540258d2a6bc8b380c1798))
* implement code formatting for generated TypeScript in publish modal ([7feb628](https://github.com/carteracredit/workflow/commit/7feb6283adf7b34217c3c0cb9b19eb795c262be0))
* implement workflow list and editor pages ([e28643c](https://github.com/carteracredit/workflow/commit/e28643c1d7bd532aac1667ff807a7d1247165968))
* integrate flag management and state display in WorkflowEditor ([b5ba2a2](https://github.com/carteracredit/workflow/commit/b5ba2a25b559a0f9bf1958751d6e0475c3ce1f14))
* integrate flag retrieval and state management in WorkflowEditor ([37d3275](https://github.com/carteracredit/workflow/commit/37d32753565bb8b9896a8e42a022a982c0911d9d))

# [1.0.0-rc.16](https://github.com/carteracredit/workflow/compare/v1.0.0-rc.15...v1.0.0-rc.16) (2026-02-27)


### Bug Fixes

* standardize code generation references and improve test assertions ([849f083](https://github.com/carteracredit/workflow/commit/849f0839a7125342fe0e2c405463f318e2dbe914))
* update string formatting in code generation tests and implementation ([82ffe58](https://github.com/carteracredit/workflow/commit/82ffe5804313196a8acd9930cc79cf10333ad3cd))


### Features

* add function to trim trailing blank lines in generated code ([f36bbca](https://github.com/carteracredit/workflow/commit/f36bbcaab7132fc5eb1534cfaff15bec0cd872f4))
* enhance error handling in WorkflowEditor and PublishModal ([a15c59a](https://github.com/carteracredit/workflow/commit/a15c59abbf38bf1a4d1dad22b30cf2d0b59ed3ae))
* improve class declaration formatting in code generation ([956eaf4](https://github.com/carteracredit/workflow/commit/956eaf4ada9f14ca327be2e180afefba7abe7fc7))

# [1.0.0-rc.15](https://github.com/carteracredit/workflow/compare/v1.0.0-rc.14...v1.0.0-rc.15) (2026-02-25)


### Features

* enhance PublishModal with deployment status and workflow publishing ([dc77885](https://github.com/carteracredit/workflow/commit/dc77885f8656be58812cb3a1bb843ea5fde8e9ce))

# [1.0.0-rc.14](https://github.com/carteracredit/workflow/compare/v1.0.0-rc.13...v1.0.0-rc.14) (2026-02-25)


### Features

* add logging to getExternalOrigin function in middleware ([68e0c79](https://github.com/carteracredit/workflow/commit/68e0c7948bd49d0e3b6e110cbc861725377c8cd4))
* implement workflow API integration and session management ([c98a48f](https://github.com/carteracredit/workflow/commit/c98a48f7accf5cd208ac70abbb42aec9fac2d30f))

# [1.0.0-rc.13](https://github.com/carteracredit/workflow/compare/v1.0.0-rc.12...v1.0.0-rc.13) (2026-02-23)


### Features

* add logging to getExternalOrigin function in middleware ([68e0c79](https://github.com/carteracredit/workflow/commit/68e0c7948bd49d0e3b6e110cbc861725377c8cd4))
* implement workflow API integration and session management ([c98a48f](https://github.com/carteracredit/workflow/commit/c98a48f7accf5cd208ac70abbb42aec9fac2d30f))
* add logging to getExternalOrigin function in middleware ([68e0c79](https://github.com/carteracredit/workflow/commit/68e0c7948bd49d0e3b6e110cbc861725377c8cd4))
* add logging to getExternalOrigin function in middleware ([68e0c79](https://github.com/carteracredit/workflow/commit/68e0c7948bd49d0e3b6e110cbc861725377c8cd4))
* add PublishModal for workflow publishing with progress tracking ([f0f21ea](https://github.com/carteracredit/workflow/commit/f0f21eae33e4e86fb8402846f6a380a98dd62b0a))

# [1.0.0-rc.12](https://github.com/carteracredit/workflow/compare/v1.0.0-rc.11...v1.0.0-rc.12) (2026-02-23)


### Bug Fixes

* **ci:** remove hardcoded pnpm v9 from release workflow to match packageManager field ([b771dc5](https://github.com/carteracredit/workflow/commit/b771dc508ab9196b3eeb72033a3df49c93c9145d))


### Features

* add authentication middleware and session management ([6151b80](https://github.com/carteracredit/workflow/commit/6151b8082eefa32af04f05c3278a2bbdcdd49527))
* enhance workflow testing and configuration ([da93f7a](https://github.com/carteracredit/workflow/commit/da93f7ab917822df7fb8967b9be56c83e2a18f99))
* integrate LanguageProvider and enhance Storybook configurations ([370bae0](https://github.com/carteracredit/workflow/commit/370bae0c29a29ea1ee428ad1f2ab21e064146a2a))

# [1.0.0-rc.11](https://github.com/carteracredit/workflow/compare/v1.0.0-rc.10...v1.0.0-rc.11) (2026-01-13)


### Features

* add app icon SVG and update top bar to use the icon ([933db00](https://github.com/carteracredit/workflow/commit/933db00f34555ca2a381beb349c3dfa952ad2157))
* add code generation feature for workflows with validation and syntax highlighting ([4995820](https://github.com/carteracredit/workflow/commit/4995820b526119b87d6d69465394e72b375030b1))

# [1.0.0-rc.10](https://github.com/carteracredit/workflow/compare/v1.0.0-rc.9...v1.0.0-rc.10) (2025-12-19)


### Features

* Add toolbar shortcuts and focus management ([85e5828](https://github.com/carteracredit/workflow/commit/85e5828e2d66b33ebf637aecec99443928af628d))
* reorganize keyboard shortcuts in top bar and update layout ([13e9df7](https://github.com/carteracredit/workflow/commit/13e9df7f00765c104112487c928b255dad18ba90))
* shortcuts and add keyboard shortcuts modal with 3-column layout ([f8adb69](https://github.com/carteracredit/workflow/commit/f8adb69e4f39e8f0b173dfb2951dfeb1b0690446))

# [1.0.0-rc.9](https://github.com/carteracredit/workflow/compare/v1.0.0-rc.8...v1.0.0-rc.9) (2025-12-17)


### Features

* Add minimap edges and improve node styling ([3fb605e](https://github.com/carteracredit/workflow/commit/3fb605e498d6395fec80fcc3b9e126147ec0a1ff))

# [1.0.0-rc.8](https://github.com/carteracredit/workflow/compare/v1.0.0-rc.7...v1.0.0-rc.8) (2025-12-17)


### Features

* Add Storybook stories for UI components and workflow ([18883b4](https://github.com/carteracredit/workflow/commit/18883b440b514741ffa43dbfd2b9c7aca129bc28))

# [1.0.0-rc.7](https://github.com/carteracredit/workflow/compare/v1.0.0-rc.6...v1.0.0-rc.7) (2025-12-17)


### Features

* Add redo functionality to workflow editor ([3ab4101](https://github.com/carteracredit/workflow/commit/3ab4101b5adac4121a0a4c88cd73746e2870ac74))

# [1.0.0-rc.6](https://github.com/carteracredit/workflow/compare/v1.0.0-rc.5...v1.0.0-rc.6) (2025-12-17)


### Features

* Allow disabling history recording for node updates ([f818142](https://github.com/carteracredit/workflow/commit/f81814215f023325f46ae03ca0d9c3183e8c2b13))
* Implement undo/redo functionality for workflow editor ([493c3e9](https://github.com/carteracredit/workflow/commit/493c3e92d7977e52e4afbdac3a0f2e8d1abb354b))

# [1.0.0-rc.5](https://github.com/carteracredit/workflow/compare/v1.0.0-rc.4...v1.0.0-rc.5) (2025-12-17)


### Features

* enhance ThemeSwitcher with dropdown menu for theme selection ([631150c](https://github.com/carteracredit/workflow/commit/631150c1624ecfdd23bf4be332c24c49cdc2ac2d))
* Make paletteProps optional and conditionally render ([14e08d4](https://github.com/carteracredit/workflow/commit/14e08d421f8f7bb531ee3da5341fbf8d48e85b13))

# [1.0.0-rc.4](https://github.com/carteracredit/workflow/compare/v1.0.0-rc.3...v1.0.0-rc.4) (2025-12-16)


### Features

* Add canvas grid styling and tests ([004bf88](https://github.com/carteracredit/workflow/commit/004bf888cf777f39c8bca840bd132c3eaf0a79c6))

# [1.0.0-rc.3](https://github.com/carteracredit/workflow/compare/v1.0.0-rc.2...v1.0.0-rc.3) (2025-12-15)


### Features

* implement copy and paste functionality in WorkflowEditor and Canvas ([e502d15](https://github.com/carteracredit/workflow/commit/e502d1531be4ca4dfcfb9d30d2fad501ea529f00))

# [1.0.0-rc.2](https://github.com/carteracredit/workflow/compare/v1.0.0-rc.1...v1.0.0-rc.2) (2025-12-15)


### Features

* add tests for Canvas selection behavior ([4df4d2f](https://github.com/carteracredit/workflow/commit/4df4d2f49349cc8015d96a8ee89a9ea41bd252ae))
* Implement multi-node drag and selection ([451d5df](https://github.com/carteracredit/workflow/commit/451d5df0e22466096a0690fccf1cd2c209220881))
* update PropertiesPanel to handle mixed selection of nodes and edges ([31c5871](https://github.com/carteracredit/workflow/commit/31c58712c30d5d4fc9b306d6508a0d29db3560f5))

# 1.0.0-rc.1 (2025-12-14)


### Features

* Add CI and release workflows ([52f8559](https://github.com/carteracredit/workflow/commit/52f85592eafdb2b2ea047ac977774e8d7ecd6406))
* Add tests for UI components and utility functions ([24b2b72](https://github.com/carteracredit/workflow/commit/24b2b72b1916f5297040a1cf5374d4152eee4b78))

# 1.0.0 (2025-12-14)


### Bug Fixes

* adding cf build script ([e4304da](https://github.com/algtools/next-template/commit/e4304dae686a6cabe53f20a6a88d73f6d6d1dbbe))
* update CI workflow to skip Chromatic publishing on 'dev' branch ([17b1390](https://github.com/algtools/next-template/commit/17b1390591887196d224e5b7e6f214b824b93372))


### Features

* Add core functionality ([1cfb1d8](https://github.com/algtools/next-template/commit/1cfb1d8bb6bd41aa3e7d2808b143d41c56d183dd))
* add TodoApp component with local storage support and UI enhancements ([dd9a9e6](https://github.com/algtools/next-template/commit/dd9a9e68c5bccca24531aa595efd47143bc59ba4))
* integrate storybook ([72c57c8](https://github.com/algtools/next-template/commit/72c57c8bc2114ba1bfa9e993f479edf5198ec87c))
* Integrate SWR for data fetching and update TodoApp ([ee15a61](https://github.com/algtools/next-template/commit/ee15a6143cea5dacef562c97ee6ed7cd8f7241e6))

# [1.0.0-rc.4](https://github.com/algtools/next-template/compare/v1.0.0-rc.3...v1.0.0-rc.4) (2025-12-14)


### Features

* Add core functionality ([1cfb1d8](https://github.com/algtools/next-template/commit/1cfb1d8bb6bd41aa3e7d2808b143d41c56d183dd))

# [1.0.0-rc.3](https://github.com/algtools/next-template/compare/v1.0.0-rc.2...v1.0.0-rc.3) (2025-12-13)


### Bug Fixes

* update CI workflow to skip Chromatic publishing on 'dev' branch ([17b1390](https://github.com/algtools/next-template/commit/17b1390591887196d224e5b7e6f214b824b93372))

# [1.0.0-rc.2](https://github.com/algtools/next-template/compare/v1.0.0-rc.1...v1.0.0-rc.2) (2025-12-13)


### Features

* integrate storybook ([72c57c8](https://github.com/algtools/next-template/commit/72c57c8bc2114ba1bfa9e993f479edf5198ec87c))

# 1.0.0-rc.1 (2025-12-13)


### Bug Fixes

* adding cf build script ([e4304da](https://github.com/algtools/next-template/commit/e4304dae686a6cabe53f20a6a88d73f6d6d1dbbe))


### Features

* add TodoApp component with local storage support and UI enhancements ([dd9a9e6](https://github.com/algtools/next-template/commit/dd9a9e68c5bccca24531aa595efd47143bc59ba4))
* Integrate SWR for data fetching and update TodoApp ([ee15a61](https://github.com/algtools/next-template/commit/ee15a6143cea5dacef562c97ee6ed7cd8f7241e6))

# Changelog

All notable changes to this project will be documented in this file.
