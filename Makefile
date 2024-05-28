remove-deploy:
	SLS_DEBUG=* serverless remove --stage production --region us-east-1 --verbose

deploy:
	SLS_DEBUG=* serverless deploy --stage production --region us-east-1 --verbose

package:
	serverless package

up:
	docker compose up -d

down: 
	docker compose down

serv:
	serverless offline