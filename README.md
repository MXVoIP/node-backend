# node-backend
Backend services using nodejs

# Monorepo conventions

## configuration files
---
Each service and potentially some libs, will use the npm package `config` for
managing configuration files. https://www.npmjs.com/package/config

By default the configuration files will be in the `<project root>/<service or lib name>/config` folder. At
a minimum developers should define a default and are strongly encouraged to setup a custom-environment-variables
file as well.

## environment variables
---
As mentioned above about configuration files, all environment variable overrides should be placed
in the `config/custom-environment-variables` files. This will clearly document what environment variables
will overload what configuration settings.

## Shared libraries - the __**lib**__ folder
---
This is where internal libraries like logging etc. are maintained

## deployable services - the __**service**__ folder
---
This is where main services are maintained. They may reference/depend on one or more
packages from the `lib` workspaces however they MUST NOT include references or dependencies
on other services.
### __Dockerfile required!__
All services must contain a `Dockerfile`
### __Unit tests required!__
All services are expected to have unit tests that meet or exceed interface specifications
#### __Code coverage is not an afterthought!__
Code coverage from the unit tests should be well documented. Both sets of code covereage including
overrides and not including overrides should be included in output.
### __Code review__
Have multiple people review pull requests to master whenever possible
### Continuous Integration
A CI file such as `.travis.yml` needs to be maintained.

## utils
---
These are utilities developers and maintainers can use to help them setup their environments, run local tests, and
anything that is helpful to developers but never going to be deployed or referenced by anything in production.