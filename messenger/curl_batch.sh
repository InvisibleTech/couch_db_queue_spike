for i in {1..100}
do
curl -X POST -H "Content-Type: application/json" \
  --data '{"topic":"mice","eating":"pizza"}' \
  http://localhost:8888/messages
done