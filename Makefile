IMG ?= kserve/models-web-app
TAG ?= $(shell git describe --tags --always --dirty)
ARCH ?= linux/amd64

# Prettier UI format check.
prettier-check:
	npm run format:check --prefix frontend


docker-build:
	docker build -t ${IMG}:${TAG} .

docker-push:
	docker push $(IMG):$(TAG)

.PHONY: docker-build-multi-arch
docker-build-multi-arch: ##  Build multi-arch docker images with docker buildx
	docker buildx build --platform ${ARCH} --tag ${IMG}:${TAG} .


.PHONY: docker-build-push-multi-arch
docker-build-push-multi-arch: ## Build multi-arch docker images with docker buildx and push to docker registry
	docker buildx build --platform ${ARCH} --tag ${IMG}:${TAG} --push .

image: docker-build docker-push
