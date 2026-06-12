#!/usr/bin/env sh
set -eu

DEFAULT_IMAGE="feeeng/edu-system"
IMAGE="${DOCKER_IMAGE:-$DEFAULT_IMAGE}"
TAG="${DOCKER_TAG:-latest}"
PUSH="${DOCKER_PUSH:-false}"
TAG_LATEST="true"

print_help() {
  cat <<EOF
用法:
  sh scripts/docker-build-push.sh
  sh scripts/docker-build-push.sh --push
  sh scripts/docker-build-push.sh --tag v1.0.0 --push

参数:
  --image <name>  镜像名，默认 $DEFAULT_IMAGE
  --tag <tag>     镜像标签，默认 latest
  --push          构建完成后推送镜像
  --no-latest     指定非 latest tag 时，不额外更新 latest

环境变量:
  DOCKER_IMAGE    覆盖默认镜像名
  DOCKER_TAG      覆盖默认标签
  DOCKER_PUSH     设置为 true 时推送镜像
EOF
}

while [ "$#" -gt 0 ]; do
  case "$1" in
    --image)
      if [ "$#" -lt 2 ] || [ -z "$2" ]; then
        echo "--image 需要指定值" >&2
        exit 1
      fi
      IMAGE="$2"
      shift 2
      ;;
    --tag)
      if [ "$#" -lt 2 ] || [ -z "$2" ]; then
        echo "--tag 需要指定值" >&2
        exit 1
      fi
      TAG="$2"
      shift 2
      ;;
    --push)
      PUSH="true"
      shift
      ;;
    --no-latest)
      TAG_LATEST="false"
      shift
      ;;
    -h|--help)
      print_help
      exit 0
      ;;
    *)
      echo "未知参数: $1" >&2
      print_help >&2
      exit 1
      ;;
  esac
done

IMAGE_TAG="${IMAGE}:${TAG}"

docker build -t "$IMAGE_TAG" .

if [ "$TAG" != "latest" ] && [ "$TAG_LATEST" = "true" ]; then
  docker tag "$IMAGE_TAG" "${IMAGE}:latest"
fi

if [ "$PUSH" = "true" ]; then
  docker push "$IMAGE_TAG"
  if [ "$TAG" != "latest" ] && [ "$TAG_LATEST" = "true" ]; then
    docker push "${IMAGE}:latest"
  fi
fi

echo "镜像已构建: $IMAGE_TAG"
if [ "$TAG" != "latest" ] && [ "$TAG_LATEST" = "true" ]; then
  echo "latest 已更新: ${IMAGE}:latest"
fi
if [ "$PUSH" = "true" ]; then
  echo "镜像已推送完成"
fi
