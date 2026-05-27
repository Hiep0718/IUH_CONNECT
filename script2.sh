#!/bin/bash
cd /home/thanhhiep/iuhconnect
sed -i 's/$//' .env
export $(grep -v '^#' .env | xargs)
docker stack deploy -c docker-stack.yml iuhconnect
