#!/bin/sh
case "$1" in
  Username*) echo "mahad717" ;;
  Password*) cat /home/z/my-project/.gh-token ;;
esac
