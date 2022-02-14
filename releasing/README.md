# Releasing

This folder contains helper files for releasing the images and manifests of the
web app.

## Steps for releasing

1. Create a new release branch
    ```
    VERSION="v0.7.0"
    RELEASE_BRANCH="release-0.7"
    git checkout -b $RELEASE_BRANCH origin/master
    ```
2. Update the VERSION file with the corresponding tag
3. Update the app's kustomization file to use the new tag
4. Submit the PR
5. Once merged the GH Action will tag and push an image based on the contents
   of the VERSION file
