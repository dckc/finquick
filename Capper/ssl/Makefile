# cribbed from
# https://help.ubuntu.com/14.04/serverguide/certificates-and-security.html

ca.crt:

server.key:
	openssl genrsa -out server.key

server.csr: server.key
	openssl req -new -key server.key -out server.csr

CA=/etc/ssl/madmodeCA

$(CA) /etc/ssl/newcerts:
	sudo mkdir $(CA)
	sudo mkdir /etc/ssl/newcerts

$(CA)/index.txt: $(CA)
	sudo touch $(CA)/index.txt

$(CA)/serial: $(CA)
	sudo sh -c "echo '01' > $(CA)/serial"

/etc/ssl/private/cakey.pem /etc/ssl/certs/cacert.pem:
	openssl req -new -x509 -extensions v3_ca -keyout cakey.pem -out cacert.pem -days 3650
	sudo mv cakey.pem /etc/ssl/private/
	sudo mv cacert.pem /etc/ssl/certs/

/etc/ssl/newcerts/01.pem: server.csr /etc/ssl/private/cakey.pem \
		/etc/ssl/newcerts $(CA)/index.txt
	sudo openssl ca -in server.csr -config /etc/ssl/openssl.cnf

# pav.crt: /etc/ssl/newcerts/01.pem
pav.crt:
	openssl x509 -in /etc/ssl/newcerts/01.pem -inform PEM -outform DER -out $@
