# Validation library wrapper

This library simply wraps the common use of the npm modules `jsonschema` and
`validator` into a single library since they are often used together. This also means
it will be easier to substitute alternative libraries in a single place if necessary.

## validateSchema (instance, srcSchema, requiredFields,  additionalFields=false)

Heavy use of JSONSCHEMA is expected. It can be used not only to validate input and
responses, but to also generate test data via packages such as `json-schema-faker`.

This wraps the `jsonschema.validate` method and allows the developer to define a generic
schema and at validation time specify the required fields and if additional fields will
be accepted.
