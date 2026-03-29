

This is your project structure 

src/ 
  * modals 
  * services 
  * processors 
  * utils 
  * calculators  ( this contains all unit conversions, rolling average logic functions etc )


## In Plan Mode 

 * Construct the PLAN 
 * Construct a TODO 
 * Use the latest EPIC 
 * Save the PLAN and the todo list in THE FOLDER 

  EPICS/EPIC-<0001>/<000N>-<issue title>.md 

  and store the tests in 

  EPICS/EPIC-<0001>/<000N>-<issue title>/{tests/. }


## Build Mode 

Write down issues ,  and todos etc 

When you are done update the todos 


## Deploying the Plugin 

use 

```bash
npm run deploy && obsidian plugin:reload id=obsidian-pantry
```


