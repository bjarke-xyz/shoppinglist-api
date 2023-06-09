#!/usr/bin/env bash

export NO_D1_WARNING=true

database="shoppinglist_db"

main() {
  env=$1

  if [ "$env" == "local" ]; then
    for f in ./migrations/*.sql; do
      echo "Running $f file on $env..."
      npx wrangler d1 execute $database --file $f --local
    done
  elif [ "$env" == "prod" ]; then
    for f in ./migrations/*.sql; do
      echo "Running $f file on prod..."
      npx wrangler d1 execute $database --file $f
    done
  else
    echo "Invalid env specified: $env. Must be one of: 'local' | 'prod'"
  fi
}
main "$@"
