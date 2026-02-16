"""JWT size middleware."""

import os
from flask import request, jsonify
from werkzeug.exceptions import BadRequest
from kubeflow.kubeflow.crud_backend import logging

log = logging.getLogger(__name__)

JWT_WARNING_THRESHOLD = int(os.environ.get("JWT_WARNING_THRESHOLD", "16000"))
JWT_ERROR_THRESHOLD = int(os.environ.get("JWT_ERROR_THRESHOLD", "28000"))


def register_jwt_middleware(app):
    @app.before_request
    def check_jwt_size():
        try:
            auth_header = request.headers.get('Authorization', '')
            userid_header_name = os.environ.get('USERID_HEADER', 'kubeflow-userid')
            userid_header = request.headers.get(userid_header_name, '')
            
            jwt_headers_size = len(auth_header) + len(userid_header)
            total_headers_size = sum(len(k) + len(v) for k, v in request.headers)
            
            log.debug(f"Headers analysis - Total: {total_headers_size}, JWT: {jwt_headers_size}")
            
            if jwt_headers_size > JWT_ERROR_THRESHOLD:
                error_msg = {
                    "error": "JWT token too large",
                    "message": "JWT token size exceeds server limits. This typically occurs with identity providers like Azure AD when users have many group memberships.",
                    "details": {
                        "size": jwt_headers_size,
                        "threshold": JWT_ERROR_THRESHOLD
                    }
                }
                log.error(f"JWT token size {jwt_headers_size} exceeds threshold {JWT_ERROR_THRESHOLD}")
                return jsonify(error_msg), 413
            
            elif jwt_headers_size > JWT_WARNING_THRESHOLD:
                log.warning(f"Large JWT token detected: {jwt_headers_size} bytes")
                
        except Exception as e:
            log.error(f"JWT middleware error: {str(e)}")
            
        return None
    
    @app.errorhandler(BadRequest)
    def handle_bad_request(error):
        try:
            if hasattr(request, 'headers'):
                total_headers_size = sum(len(k) + len(v) for k, v in request.headers)
                if total_headers_size > JWT_WARNING_THRESHOLD:
                    log.error(f"Bad request with large headers: {total_headers_size} bytes")
                    return jsonify({
                        "error": "Request headers too large",
                        "message": "Request could not be processed due to large headers"
                    }), 400
        except Exception as e:
            log.error(f"Bad request handler error: {str(e)}")
        
        return jsonify({
            "error": "Bad Request", 
            "message": "The server could not understand the request"
        }), 400