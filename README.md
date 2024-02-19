# Project

## Overview

I thought of breaking down the project into three disctinct files to divide and conquer the things we are going ot add. The file called temptatively `beach-coast.js` is where all the scene stuff will happen but I suggest we add helper functions as well as shaders and shapes in a separate file as I did. Currently the code is housed in three different files as such:

```
./src/
├─ beach-coast.js
├─ custom-shaders.js
└─ custom-shapes.js
```

I would say we do not use the default directories of `examples` and `assets` for anything because they already contain other files and honestly I prefer better organization. For our images and objets I added two directories (which have an empty readme right now because git cannot track empty directories).

## Suggestions to add code

I think when you are about to add something you should make a new branch. The format I suggest is `feature/name-of-feature`. Whenver you have finalized your changes and did some testing make a PR (pull request) to master, and I will review the changes and fix any conflicts if needed.

I am not sure which software you guys are going to use, but if it is VSCode I have setup the default task to build and open your browser with the localhost at port 8000 (I edited the python script). That means you can also press `Ctrl`+`Shift`+`B` to launch the application (just press it once).

If it is intellij (webstorm), then I think it does it on its own? I am not sure. I have not used Webstorm.

## How to run

Like I said above I modified the `server.py` script so now when you launch it, it will automatically open your default browser at `localhost:8000`. So you can run it from the terminal or open the `host.bat` or `host.command` and expect the same behavior.

![default screen at empty project](./images/default-screen-empty.png)
