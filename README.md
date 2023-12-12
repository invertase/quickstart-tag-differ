# Firebase tag differ

## Description

This action diffs in the current commit, and a base commit, and annotates the pull request with the results.
It looks for the following syntax for tags:

```
// [START <tag-name>]
<code>
// [END <tag-name>]
```

## Usage

The

```yaml
- uses: actions/checkout@v2
- uses: invertase/quickstart-tag-differ@v1
  with:
    base-ref: main # optional, defaults the pull request base ref or errors if not a pull request
    extensions: js,ts # optional, defaults to `js,ts,kt,java,swift`
```
