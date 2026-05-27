#!/bin/bash
cd /home/thanhhiep/iuhconnect
sed -i "s/- \"8080:8080\"/- \"8081:8080\"/g" docker-stack.yml
sed -i 's/- 8080:8080/- 8081:8080/g' docker-stack.yml
sed -i 's/start_period: 30s/start_period: 180s/g' docker-stack.yml
sed -i 's/start_period: 40s/start_period: 180s/g' docker-stack.yml
sed -i 's/retries: 3/retries: 5/g' docker-stack.yml
export $(grep -v '^#' .env | xargs)
docker stack deploy -c docker-stack.yml iuhconnect
