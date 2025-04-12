# Releasing

This folder contains helper files for releasing the OCI images and manifests of the
kserve models web application.

## Steps for releasing

1. Create a new release branch
    ```
    VERSION="v0.13.0-rc.0"
    RELEASE_BRANCH="v0.13.0-rc.0"
    git checkout -b $RELEASE_BRANCH origin/master
    ```
2. Update the VERSION file with the corresponding tag
3. Update the applications kustomization file to use the new tag
4. Submit the pull request
5. Once merged the GitHub action will tag and push an OCI image based on the contents of the VERSION file
