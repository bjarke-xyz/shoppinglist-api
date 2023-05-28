#!/usr/bin/env bash

export NO_D1_WARNING=true

database="shoppinglist_db"

main() {
  echo "Executing migrations. Continue? [y,n]"
  read input

  if [ "$input" == "y" ]; then
    for f in ./migrations/*.sql; do
      echo "Running $f file on local..."
      npx wrangler d1 execute $database --file $f --local
    done

    if [ "$1" == "prod" ]; then
      for f in ./migrations/*.sql; do
        echo "Running $f file on prod..."
        npx wrangler d1 execute $database --file $f
      done
    fi
  else
    exit 0
  fi
}
main "$@"
