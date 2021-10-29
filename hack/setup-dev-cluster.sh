#!/usr/bin/env bash

# Dependencies:
# kind==0.11.1
# kubectl [compatible with K8s 1.19]
#

# strict mode http://redsymbol.net/articles/unofficial-bash-strict-mode/
set -euo pipefail
IFS=$'\n\t'

SCRIPT_DIR="$( cd -- "$( dirname -- "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
source ${SCRIPT_DIR}/variables.sh

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


kind create cluster --name kserve --image ${KIND_NODE}

# Install KServe
if [[ ! -d ${KSERVE_DIR} ]]; then
    cd /tmp
    git clone ${KSERVE_REPO}
fi

cd ${KSERVE_DIR}
git checkout ${KSERVE_COMMIT}
./hack/quick_install.sh

# use the KinD cluster
kubectl config set-context kind-kserve
