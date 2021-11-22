#!/usr/bin/env bash

# Dependencies:
# kind==0.11.1
# kubectl [compatible with K8s 1.19]
#

# strict mode http://redsymbol.net/articles/unofficial-bash-strict-mode/
set -euo pipefail
IFS=$'\n\t'

############################################################
# Help                                                     #
############################################################
Help()
{
   # Display Help
   echo "Setup the dev environment for using the web app."
   echo
   echo "Dependencies"
   echo "kind 0.11.1"
   echo "kubectl [compatible with K8s 1.19]"
}

export KIND_CLUSTER=kserve
DeleteCluster()
{
    kind delete cluster --name ${KIND_CLUSTER}
}

while getopts ":hd" option; do
   case $option in
      h) # display Help
         Help
         exit;;
      d) # delete cluster
         DeleteCluster
         exit;;
     \?) # Invalid option
         echo "Error: Invalid option"
         exit;;
   esac
done

export KSERVE_REPO=https://github.com/kserve/kserve.git
export KSERVE_TAG=v0.7.0
export KSERVE_DIR=${KSERVE_DIR:=/tmp/kserve}

# Create the kind cluster
export KIND_NODE=kindest/node:1.19.0@sha256:3b0289b2d1bab2cb9108645a006939d2f447a10ad2bb21919c332d06b548bbc6

kind create cluster --name kserve --image ${KIND_NODE}

# Install KServe
if [[ ! -d ${KSERVE_DIR} ]]; then
    cd /tmp
    git clone ${KSERVE_REPO}
fi

cd ${KSERVE_DIR}
git checkout ${KSERVE_TAG}
./hack/quick_install.sh

# use the KinD cluster
kubectl config set-context kind-kserve
